import { NextRequest, NextResponse } from "next/server";
import { PaymentReceiptStatus, PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

/**
 * Bir dekontu onaylar/reddeder. Onaylanırsa — ve taksit hâlâ PENDING ise —
 * app/api/branch/payment-installments/[id]/collect ile AYNI çekirdek mantık
 * (PENDING→PAID + Muhasebe defteri kaydı) uygulanır; kategori adı demo'nun
 * "Taksit Tahsilatı (Havale · Dekont Onaylı)" biçimiyle birebir eşleşir.
 */
export async function POST(request: NextRequest, { params }: { params: { receiptId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol dekont onaylayamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = body.decision === "APPROVE" || body.decision === "REJECT" ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ message: "decision \"APPROVE\" veya \"REJECT\" olmalıdır" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const receipt = await tx.paymentReceipt.findUnique({ where: { id: params.receiptId }, include: { installment: true } });
    if (!receipt) return { kind: "not_found" as const };
    if (receipt.status !== PaymentReceiptStatus.BEKLIYOR) {
      return { kind: "already_reviewed" as const, status: receipt.status };
    }

    if (decision === "REJECT") {
      const updated = await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: { status: PaymentReceiptStatus.REDDEDILDI, reviewedAt: new Date(), reviewedByUserId: actor.id },
      });
      return { kind: "rejected" as const, receipt: updated };
    }

    const updatedReceipt = await tx.paymentReceipt.update({
      where: { id: receipt.id },
      data: { status: PaymentReceiptStatus.ONAYLANDI, reviewedAt: new Date(), reviewedByUserId: actor.id },
    });

    let ledgerEntry = null;
    if (receipt.installment.status === PaymentStatus.PENDING) {
      const updateResult = await tx.paymentInstallment.updateMany({
        where: { id: receipt.installment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID, paidAt: new Date(), providerTransactionId: `DEKONT-${receipt.id}` },
      });
      if (updateResult.count > 0) {
        ledgerEntry = await tx.accountingLedgerEntry.create({
          data: {
            tenantId: receipt.tenantId,
            type: "GELIR",
            category: "Taksit Tahsilatı (Havale · Dekont Onaylı)",
            amount: receipt.installment.amount,
            entryDate: new Date(),
            createdByUserId: actor.id,
            relatedInstallmentId: receipt.installment.id,
          },
        });
      }
    }

    return { kind: "approved" as const, receipt: updatedReceipt, ledgerEntry };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Dekont bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_reviewed") {
    return NextResponse.json({ message: `Bu dekont zaten "${outcome.status}" durumunda.` }, { status: 409 });
  }
  return NextResponse.json({ receipt: outcome.receipt }, { status: 200 });
}
