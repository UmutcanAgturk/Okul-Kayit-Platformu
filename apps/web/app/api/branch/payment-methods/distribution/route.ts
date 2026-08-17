import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Ödeme Yöntemleri — "Yöntem Dağılımı" paneli (demo'daki
 * paymentMethodStudentCounts/renderPaymentMethodDistribution). Demo, her
 * öğrencide tek bir denormalize paymentMethodType alanı tutuyordu (SENET
 * dahil); gerçek şemada SENET ayrı bir PaymentMethod DEĞİLDİR (bkz.
 * app/api/branch/enrollments/[enrollmentId]/complete — SENET seçilince
 * PaymentMethod yerine PromissoryNote satırları üretilir), bu yüzden burada
 * bir öğrenci sırasıyla: varsayılan PaymentMethod'u varsa onun türü, yoksa
 * en az bir PromissoryNote'u varsa SENET, ikisi de yoksa NONE olarak sayılır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi dağılımını görüntüleyemez" }, { status: 403 });
  }

  const students = await withBranchTenantContext(actor, (tx) =>
    tx.studentProfile.findMany({
      select: {
        paymentMethods: { where: { isDefault: true }, take: 1, select: { type: true } },
        promissoryNotes: { take: 1, select: { id: true } },
      },
    }),
  );

  const counts = { KREDI_KARTI: 0, BANKA_HAVALESI: 0, NAKIT: 0, SENET: 0, NONE: 0 };
  for (const s of students) {
    const defaultMethod = s.paymentMethods[0];
    if (defaultMethod) counts[defaultMethod.type]++;
    else if (s.promissoryNotes.length > 0) counts.SENET++;
    else counts.NONE++;
  }

  return NextResponse.json({ counts, total: students.length });
}
