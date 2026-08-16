import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Şubenin taksitlerini listeler — `/collect` route'u yalnızca tek bir
 * `installmentId` üzerinden çalışıyordu, o ID'yi önceden bulacak bir liste
 * yoktu. Muhasebe defteri route'undaki desenle aynı (accounting-ledger):
 * SUPERADMIN, "hangi şubenin taksitleri" belirsizliğini Kurumlar sayfasından
 * "Bu Şube Olarak Yönet" ile açıkça seçerek çözer (bkz. lib/db-context.ts
 * withBranchTenantContext) — o zaman bu route'a erişebilir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol taksitleri görüntüleyemez" }, { status: 403 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status");

  const installments = await withBranchTenantContext(actor, (tx) =>
    tx.paymentInstallment.findMany({
      where: statusFilter === "PENDING" || statusFilter === "PAID" ? { status: statusFilter } : undefined,
      orderBy: { dueDate: "asc" },
      include: { student: { include: { user: true } } },
    }),
  );

  return NextResponse.json({
    installments: installments.map((i) => ({
      id: i.id,
      studentId: i.studentId,
      studentName: `${i.student.user.firstName} ${i.student.user.lastName}`,
      installmentNo: i.installmentNo,
      amount: i.amount,
      dueDate: i.dueDate,
      paidAt: i.paidAt,
      status: i.status,
    })),
  });
}
