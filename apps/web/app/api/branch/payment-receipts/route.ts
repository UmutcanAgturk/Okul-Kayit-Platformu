import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

/**
 * Ödeme Yöntemleri — Bekleyen Dekont Onayları. demo'daki "renderPendingReceipts"
 * panelinin gerçek karşılığı — bkz. prisma/schema.prisma PaymentReceipt notu.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol dekontları görüntüleyemez" }, { status: 403 });
  }

  const receipts = await withBranchTenantContext(actor, (tx) =>
    tx.paymentReceipt.findMany({
      orderBy: { submittedAt: "desc" },
      include: { student: { include: { user: true } }, installment: true },
    }),
  );

  return NextResponse.json({
    receipts: receipts.map((r) => ({
      id: r.id,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      installmentNo: r.installment.installmentNo,
      amount: r.installment.amount,
      fileName: r.fileName,
      mimeType: r.mimeType,
      dataUrl: r.dataUrl,
      note: r.note,
      status: r.status,
      submittedAt: r.submittedAt,
    })),
  });
}
