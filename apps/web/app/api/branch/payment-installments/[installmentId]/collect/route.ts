import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Bir taksiti tahsil edilmiş olarak işaretler ve karşılığında bir Muhasebe
 * (AccountingLedgerEntry) kaydı oluşturur — demo artifact'ındaki (seviye360-app.html)
 * "Tahsilat Al" butonunun, Prisma'nın taksit-başına-satır modeliyle gerçek bir
 * veritabanına karşı çalışan karşılığı (bkz. demo/seviye360/PRISMA-UZLASMA.md,
 * madde 1). Demo'nun aksine hangi taksitin ödendiği kalıcı olarak izlenir.
 *
 * Race condition koruması: `updateMany` ile koşullu güncelleme (yalnızca hâlâ
 * PENDING ise) atomik olarak yapılır — iki eşzamanlı istek aynı taksiti iki kez
 * tahsil edemez.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { installmentId: string } },
) {
  const body = await request.json().catch(() => ({}));
  const collectedByUserId = typeof body.collectedByUserId === "string" ? body.collectedByUserId : null;

  if (!collectedByUserId) {
    return NextResponse.json({ message: "collectedByUserId zorunludur" }, { status: 400 });
  }

  const installment = await prisma.paymentInstallment.findUnique({
    where: { id: params.installmentId },
  });

  if (!installment) {
    return NextResponse.json({ message: "Taksit bulunamadı" }, { status: 404 });
  }

  if (installment.status !== PaymentStatus.PENDING) {
    return NextResponse.json(
      { message: `Bu taksit zaten "${installment.status}" durumunda — tekrar tahsil edilemez.` },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.paymentInstallment.updateMany({
      where: { id: installment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        providerTransactionId: `PARAMPOS-DEV-${Date.now()}`,
      },
    });

    if (updateResult.count === 0) {
      // Bu noktaya yalnızca eşzamanlı bir istek araya girip taksiti bizden
      // önce tahsil ettiyse düşülür.
      return null;
    }

    const updatedInstallment = await tx.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });

    const ledgerEntry = await tx.accountingLedgerEntry.create({
      data: {
        tenantId: installment.tenantId,
        type: "GELIR",
        category: "Taksit Tahsilatı",
        amount: installment.amount,
        entryDate: new Date(),
        createdByUserId: collectedByUserId,
        relatedInstallmentId: installment.id,
      },
    });

    return { installment: updatedInstallment, ledgerEntry };
  });

  if (!result) {
    return NextResponse.json(
      { message: "Bu taksit eşzamanlı başka bir istekle az önce tahsil edildi." },
      { status: 409 },
    );
  }

  return NextResponse.json(result, { status: 200 });
}
