import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, PtaRequestStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * "Bugün" Özet Ekranı — demo'daki "branch:bugun" ekranının karşılığı. Demo'nun
 * kendi yorumundaki gibi ("Yeni veri modeli gerektirmez") bu route da hiçbir
 * yeni tablo eklemez — Devamsızlık, Ödeme, Veli Görüşmesi ve Aktivite Akışı
 * modüllerinin BUGÜNE ait gerçek verisini tek bir yanıtta birleştirir.
 * Demo'daki Lider Tablosu/Etüt-doluluk bölümleri kasıtlı olarak dışarıda
 * bırakıldı — bu depoda henüz gerçek bir Gamification (XP/Seviye) modülü yok.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol 'Bugün' özetini görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const todayEnd = new Date(`${today}T23:59:59.999Z`);
  const in7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await withTenantContext(actor, async (tx) => {
    const [classroomsTotal, attendanceToday, overdueCount, upcomingCount, pendingPtaCount, ptaToday, recentActivity] =
      await Promise.all([
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
        tx.ptaMeetingRequest.findMany({
          where: {
            requestedAt: { gte: todayStart, lte: todayEnd },
            status: { not: PtaRequestStatus.REDDEDILDI },
          },
          include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
          orderBy: { requestedAt: "asc" },
        }),
        tx.auditLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      ]);

    return {
      date: today,
      attendance: { classroomsTotal, classroomsTakenToday: attendanceToday.length },
      payments: { overdueCount, upcomingCount },
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
