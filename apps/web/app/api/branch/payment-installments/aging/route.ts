import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Taksit tahsilatı yaşlandırma raporu — demo/seviye360-app.html'deki
 * `agingReportRows`/`agingBucketSummary` fonksiyonlarının (bkz.
 * t159_aging_report.js), gerçek bir Postgres'e karşı çalışan karşılığı.
 *
 * Şubenin vadesi geçmiş (PENDING + dueDate < bugün) taksitlerini öğrenciye
 * göre gruplar; her öğrenci için en eski vadeyi baz alarak standart bir
 * muhasebe yaşlandırma aralığına (0-30/31-60/61-90/90+ gün) atar.
 *
 * SUPERADMIN, Kurumlar sayfasından "Bu Şube Olarak Yönet" ile bir şube
 * seçtiğinde (bkz. lib/db-context.ts withBranchTenantContext) buraya da
 * erişebilir; çoklu-kurum konsolide görünüm için ayrıca /api/hq/accounting-ledger
 * kullanılır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

const AGING_BUCKETS = [
  { id: "0-30", label: "0-30 gün", max: 30 },
  { id: "31-60", label: "31-60 gün", max: 60 },
  { id: "61-90", label: "61-90 gün", max: 90 },
  { id: "90+", label: "90+ gün", max: Infinity },
] as const;

function bucketFor(daysLate: number) {
  return AGING_BUCKETS.find((b) => daysLate <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol yaşlandırma raporunu görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();

  const overdue = await withBranchTenantContext(actor, (tx) =>
    tx.paymentInstallment.findMany({
      where: { status: PaymentStatus.PENDING, dueDate: { lt: now } },
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
    }),
  );

  const byStudent = new Map<
    string,
    { studentId: string; studentName: string; count: number; totalAmount: number; oldestDueDate: Date }
  >();
  for (const installment of overdue) {
    const existing = byStudent.get(installment.studentId);
    const amount = Number(installment.amount);
    if (!existing) {
      byStudent.set(installment.studentId, {
        studentId: installment.studentId,
        studentName: `${installment.student.user.firstName} ${installment.student.user.lastName}`,
        count: 1,
        totalAmount: amount,
        oldestDueDate: installment.dueDate,
      });
    } else {
      existing.count += 1;
      existing.totalAmount += amount;
      if (installment.dueDate < existing.oldestDueDate) existing.oldestDueDate = installment.dueDate;
    }
  }

  const rows = Array.from(byStudent.values())
    .map((row) => {
      const daysLate = Math.floor((now.getTime() - row.oldestDueDate.getTime()) / (24 * 3600 * 1000));
      return { ...row, daysLate, bucketId: bucketFor(daysLate).id };
    })
    .sort((a, b) => b.daysLate - a.daysLate);

  const buckets = AGING_BUCKETS.map((bucket) => {
    const inBucket = rows.filter((r) => r.bucketId === bucket.id);
    return {
      id: bucket.id,
      label: bucket.label,
      count: inBucket.length,
      amount: inBucket.reduce((sum, r) => sum + r.totalAmount, 0),
    };
  });

  return NextResponse.json({ buckets, rows });
}
