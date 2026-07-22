import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { resolveActingUser, withTenantContext } from "@/lib/db-context";

/**
 * Bir taksiti tahsil edilmiş olarak işaretler ve karşılığında bir Muhasebe
 * (AccountingLedgerEntry) kaydı oluşturur — demo artifact'ındaki (seviye360-app.html)
 * "Tahsilat Al" butonunun, Prisma'nın taksit-başına-satır modeliyle gerçek bir
 * veritabanına karşı çalışan karşılığı (bkz. demo/seviye360/PRISMA-UZLASMA.md,
 * madde 1).
 *
 * Güvenlik: sorgular `withTenantContext` üzerinden, isteyen kullanıcının
 * VERİTABANINDAKİ gerçek tenant/rol kaydıyla (istemcinin beyan ettiği bir
 * değerle DEĞİL) RLS bağlamı kurularak çalışır — başka bir tenant'ın taksitini
 * hedeflemeye çalışan bir istek, uygulama kodundaki bir hataya rağmen bile
 * veritabanı seviyesinde durdurulur (bkz. prisma/rls).
 *
 * Race condition koruması: `updateMany` ile koşullu güncelleme (yalnızca hâlâ
 * PENDING ise) atomik olarak yapılır — iki eşzamanlı istek aynı taksiti iki kez
 * tahsil edemez.
 */
const ROLES_ALLOWED_TO_COLLECT = [UserRole.SUPERADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function POST(
  request: NextRequest,
  { params }: { params: { installmentId: string } },
) {
  const body = await request.json().catch(() => ({}));
  const collectedByUserId = typeof body.collectedByUserId === "string" ? body.collectedByUserId : null;

  if (!collectedByUserId) {
    return NextResponse.json({ message: "collectedByUserId zorunludur" }, { status: 400 });
  }

  const actor = await resolveActingUser(collectedByUserId);
  if (!actor) {
    return NextResponse.json({ message: "Geçersiz collectedByUserId" }, { status: 401 });
  }
  if (!ROLES_ALLOWED_TO_COLLECT.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol tahsilat işleyemez" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    // RLS sayesinde bu sorgu, actor'ün tenant'ına ait OLMAYAN bir taksiti
    // (SUPERADMIN hariç) zaten hiç göremez — "bulunamadı" ile "başkasının"
    // arasındaki fark burada ayırt edilmeye ÇALIŞILMAZ, ikisi de aynı 404'e
    // düşer (tenant varlığını dışarı sızdırmamak için).
    const installment = await tx.paymentInstallment.findUnique({ where: { id: params.installmentId } });
    if (!installment) return { kind: "not_found" as const };

    if (installment.status !== PaymentStatus.PENDING) {
      return { kind: "already_collected" as const, status: installment.status };
    }

    const updateResult = await tx.paymentInstallment.updateMany({
      where: { id: installment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        providerTransactionId: `PARAMPOS-DEV-${Date.now()}`,
      },
    });
    if (updateResult.count === 0) {
      // Eşzamanlı bir istek araya girip taksiti bizden önce tahsil etti.
      return { kind: "already_collected" as const, status: PaymentStatus.PAID };
    }

    const updatedInstallment = await tx.paymentInstallment.findUniqueOrThrow({ where: { id: installment.id } });
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

    return { kind: "collected" as const, installment: updatedInstallment, ledgerEntry };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Taksit bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_collected") {
    return NextResponse.json(
      { message: `Bu taksit zaten "${outcome.status}" durumunda — tekrar tahsil edilemez.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ installment: outcome.installment, ledgerEntry: outcome.ledgerEntry }, { status: 200 });
}
