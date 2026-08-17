import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Ödeme Yöntemleri: "Öğrenci Bazında Ödeme Yöntemi" tablosu — demo'daki
 * renderPaymentStudentTable'ın gerçek karşılığı (bkz.
 * demo/seviye360-app.html renderPaymentMethods). Öğrenci arama tablosu için
 * veli adı, toplam ücret (PaymentInstallment.amount toplamı), ödeme durumu
 * (students/[studentId]/detail ile AYNI TAKSIT_YOK/GECIKMIS/PLANLI/GUNCEL
 * mantığı) ve varsayılan ödeme yöntemi türünü (distribution ile AYNI
 * SENET/NONE kuralı) tek seferde döner.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci ödeme tablosunu görüntüleyemez" }, { status: 403 });
  }

  const today = new Date();
  const students = await withBranchTenantContext(actor, (tx) =>
    tx.studentProfile.findMany({
      include: {
        user: true,
        guardians: { include: { parent: { include: { user: true } } } },
        installments: true,
        paymentMethods: { where: { isDefault: true }, take: 1, select: { type: true } },
        promissoryNotes: { take: 1, select: { id: true } },
      },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  return NextResponse.json({
    students: students.map((s) => {
      const guardianRow = s.guardians.find((g) => g.isBillingResponsible) ?? s.guardians[0];
      const guardianUser = guardianRow?.parent.user;
      const totalTuition = s.installments.reduce((sum, i) => sum + Number(i.amount), 0);

      const hasOverdue = s.installments.some((i) => i.status === PaymentStatus.PENDING && i.dueDate < today);
      const hasPending = s.installments.some((i) => i.status === PaymentStatus.PENDING);
      const paymentStatus =
        s.installments.length === 0 ? "TAKSIT_YOK" : hasOverdue ? "GECIKMIS" : hasPending ? "PLANLI" : "GUNCEL";

      const defaultMethod = s.paymentMethods[0];
      const methodType = defaultMethod ? defaultMethod.type : s.promissoryNotes.length > 0 ? "SENET" : "NONE";

      return {
        id: s.id,
        studentNo: s.studentNo,
        name: `${s.user.firstName} ${s.user.lastName}`,
        guardianName: guardianUser ? `${guardianUser.firstName} ${guardianUser.lastName}` : null,
        totalTuition,
        paymentStatus,
        methodType,
      };
    }),
  });
}
