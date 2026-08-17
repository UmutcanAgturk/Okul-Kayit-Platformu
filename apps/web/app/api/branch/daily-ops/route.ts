import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, StudySessionStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * "Günlük Operasyon Paneli" — demo/seviye360-app.html'deki SCREENS["branch:ops"]'un
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ — mevcut
 * `PaymentInstallment` (bkz. app/api/branch/payment-installments, .../aging)
 * ve `StudySession` (Etüt modülü) verisini, "Bugün" Özeti'nden (bkz.
 * app/api/branch/today-summary) daha eyleme dönük (aksiyonlu) bir görünümde
 * birleştirir: gecikmiş/yaklaşan taksitler tek tek (öğrenci başına
 * gruplanmadan, `installmentId` ile) listelenir ki her satırdan doğrudan
 * `/api/branch/payment-installments/[id]/collect` çağrılabilsin; bugünkü
 * etütler ders+saat bazında gruplanır.
 *
 * Demo'daki "Personel Devam Durumu" (staff Geldi/Gelmedi/İzinli) BURADA
 * DEĞİL — kendi modeli (`StaffAttendanceRecord`) ve ayrı bir uç noktası var
 * (bkz. app/api/branch/staff-attendance), çünkü demo'daki gibi hem okuma
 * hem yazma (Geldi/Gelmedi/İzinli işaretleme) gerektiriyor; DailyOpsView bu
 * uç noktayı ayrıca çağırır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Günlük Operasyon Paneli'ni görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const todayEnd = new Date(`${today}T23:59:59.999Z`);
  const in7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await withBranchTenantContext(actor, async (tx) => {
    const [overdueRows, upcomingRows, todaySessions] = await Promise.all([
      tx.paymentInstallment.findMany({
        where: { status: PaymentStatus.PENDING, dueDate: { lt: todayStart } },
        include: { student: { include: { user: true } } },
        orderBy: { dueDate: "asc" },
      }),
      tx.paymentInstallment.findMany({
        where: { status: PaymentStatus.PENDING, dueDate: { gte: todayStart, lte: in7Days } },
        include: { student: { include: { user: true } } },
        orderBy: { dueDate: "asc" },
      }),
      tx.studySession.findMany({
        where: {
          scheduledStart: { gte: todayStart, lte: todayEnd },
          status: { notIn: [StudySessionStatus.TEACHER_REJECTED, StudySessionStatus.CANCELLED] },
        },
        include: { achievement: true },
      }),
    ]);

    const toPaymentRow = (i: (typeof overdueRows)[number]) => ({
      installmentId: i.id,
      studentId: i.studentId,
      studentName: `${i.student.user.firstName} ${i.student.user.lastName}`,
      installmentNo: i.installmentNo,
      amount: i.amount,
      dueDate: i.dueDate.toISOString().slice(0, 10),
    });

    const overduePayments = overdueRows.map((i) => ({
      ...toPaymentRow(i),
      daysLate: Math.floor((now.getTime() - i.dueDate.getTime()) / (24 * 3600 * 1000)),
    }));
    const upcomingPayments = upcomingRows.map(toPaymentRow);

    const slotGroups = new Map<string, { subject: string; time: string; count: number }>();
    for (const s of todaySessions) {
      const time = s.scheduledStart.toISOString().slice(11, 16);
      const subject = s.achievement ? subjectFromCode(s.achievement.code) : "Diğer";
      const key = `${subject}__${time}`;
      const existing = slotGroups.get(key);
      if (existing) existing.count += 1;
      else slotGroups.set(key, { subject, time, count: 1 });
    }
    const todayEtut = Array.from(slotGroups.values()).sort((a, b) => a.time.localeCompare(b.time) || a.subject.localeCompare(b.subject, "tr"));

    return {
      date: today,
      overduePayments,
      overdueTotal: overduePayments.reduce((sum, r) => sum + Number(r.amount), 0),
      upcomingPayments,
      todayEtut,
      todayEtutTotal: todaySessions.length,
    };
  });

  return NextResponse.json(result);
}
