import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, PaymentStatus, PtaRequestStatus, StudySessionStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * "Bugün" Özet Ekranı — demo'daki "branch:bugun" ekranının karşılığı. Demo'nun
 * kendi yorumundaki gibi ("Yeni veri modeli gerektirmez") bu route da hiçbir
 * yeni tablo eklemez — Devamsızlık, Ödeme, Veli Görüşmesi ve Aktivite Akışı
 * modüllerinin BUGÜNE ait gerçek verisini tek bir yanıtta birleştirir.
 * Demo'daki Lider Tablosu/Etüt-doluluğu ARTIK bu route'ta DEĞİL — o modüller
 * (Gamification/`branch/leaderboard` ve Günlük Operasyon/`branch/daily-ops`)
 * kendi gerçek uçlarına sahip; Bugün ekranı bunları doğrudan tüketir (bkz.
 * TodaySummaryDashboard). Ortalama Net Trendi de aynı şekilde mevcut
 * `branch/exams`'tan (avgNet) doğrudan tüketilir. Burada YALNIZCA başka
 * hiçbir uçta bulunmayan iki agregasyon eklendi: Devam Oranı Trendi
 * (AttendanceRecord'un tarihe göre günlük gruplanması) ve Ödeme Durumu
 * Dağılımı (her ÖĞRENCİ için — taksit değil — güncel/yaklaşan/gecikmiş
 * sınıflandırması; demo'daki paymentStatusComposition ile aynı ilke).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol 'Bugün' özetini görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const todayEnd = new Date(`${today}T23:59:59.999Z`);
  const in7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const since30Days = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const result = await withBranchTenantContext(actor, async (tx) => {
    const [
      classroomsTotal,
      attendanceToday,
      overdueCount,
      upcomingCount,
      pendingPtaCount,
      pendingEtutCount,
      ptaToday,
      recentActivity,
      recentAttendance,
      allStudents,
      allPendingInstallments,
    ] = await Promise.all([
      tx.classroom.count(),
      tx.attendanceRecord.findMany({
        where: { date: todayStart },
        select: { classroomId: true },
        distinct: ["classroomId"],
      }),
      tx.paymentInstallment.count({ where: { status: PaymentStatus.PENDING, dueDate: { lt: todayStart } } }),
      tx.paymentInstallment.count({
        where: { status: PaymentStatus.PENDING, dueDate: { gte: todayStart, lte: in7Days } },
      }),
      tx.ptaMeetingRequest.count({ where: { status: PtaRequestStatus.BEKLIYOR } }),
      tx.studySession.count({ where: { status: StudySessionStatus.AI_SUGGESTED } }),
      tx.ptaMeetingRequest.findMany({
        where: {
          requestedAt: { gte: todayStart, lte: todayEnd },
          status: { not: PtaRequestStatus.REDDEDILDI },
        },
        include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
        orderBy: { requestedAt: "asc" },
      }),
      tx.auditLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      tx.attendanceRecord.findMany({
        where: { date: { gte: since30Days, lte: todayStart } },
        select: { date: true, status: true },
      }),
      tx.studentProfile.findMany({ where: { user: { isActive: true } }, select: { id: true } }),
      tx.paymentInstallment.findMany({
        where: { status: PaymentStatus.PENDING },
        select: { studentId: true, dueDate: true },
      }),
    ]);

    const byDate = new Map<string, { present: number; total: number }>();
    for (const r of recentAttendance) {
      const key = r.date.toISOString().slice(0, 10);
      const bucket = byDate.get(key) ?? { present: 0, total: 0 };
      bucket.total += 1;
      if (r.status === AttendanceStatus.VAR) bucket.present += 1;
      byDate.set(key, bucket);
    }
    const attendanceTrend = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([date, v]) => ({ date, ratePct: Math.round((v.present / v.total) * 100) }));

    const dueDatesByStudent = new Map<string, Date[]>();
    for (const i of allPendingInstallments) {
      if (!dueDatesByStudent.has(i.studentId)) dueDatesByStudent.set(i.studentId, []);
      dueDatesByStudent.get(i.studentId)!.push(i.dueDate);
    }
    let currentCount = 0;
    let upcomingStudentCount = 0;
    let overdueStudentCount = 0;
    for (const s of allStudents) {
      const dues = dueDatesByStudent.get(s.id);
      if (!dues || dues.length === 0) {
        currentCount += 1;
      } else if (dues.some((d) => d.getTime() < todayStart.getTime())) {
        overdueStudentCount += 1;
      } else if (dues.some((d) => d.getTime() <= in7Days.getTime())) {
        upcomingStudentCount += 1;
      } else {
        currentCount += 1;
      }
    }

    return {
      date: today,
      attendance: { classroomsTotal, classroomsTakenToday: attendanceToday.length, trend: attendanceTrend },
      payments: {
        overdueCount,
        upcomingCount,
        studentComposition: { current: currentCount, upcoming: upcomingStudentCount, overdue: overdueStudentCount },
      },
      pta: {
        pendingCount: pendingPtaCount,
        today: ptaToday.map((r) => ({
          id: r.id,
          studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
          teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
          requestedAt: r.requestedAt.toISOString(),
          status: r.status,
        })),
      },
      etut: { pendingCount: pendingEtutCount },
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        actorLabel: a.actorLabel,
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  return NextResponse.json(result);
}
