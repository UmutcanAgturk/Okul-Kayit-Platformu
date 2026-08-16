import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { prismaSuperadmin } from "@/lib/prisma-superadmin";

/**
 * Ödeme İşlemleri (veli) — demo/seviye360-app.html'deki "student:payment"
 * ekranının (guardianOnly) gerçek karşılığı. Gerçek bir ödeme sağlayıcısı
 * entegrasyonu (3D Secure vb.) YOKTUR — app/api/branch/payment-installments/
 * [id]/collect ile AYNI çekirdek mantığı (PENDING→PAID + Muhasebe defteri
 * kaydı) tekrarlar, yalnızca yetki kontrolü farklıdır: personel yerine
 * SADECE öğrencinin faturalama sorumlusu (isBillingResponsible) velisi
 * kendi çocuğunun taksitini ödeyebilir.
 *
 * AccountingLedgerEntry'nin RLS politikası (bkz. prisma/rls/README.md)
 * yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING'in yazmasına izin verir —
 * PARENT'ın kendi `app_role` bağlamında bu tabloya INSERT yapması veritabanı
 * seviyesinde reddedilir (denendi, "row-level security policy" hatası
 * alındı). Bu yüzden ledger kaydı, PaymentInstallment güncellemesi PARENT'ın
 * KENDİ tenant-scope'lu (RLS'e tabi) işlemiyle doğrulanıp tamamlandıktan
 * SONRA, `prismaSuperadmin` (BYPASSRLS) ile AYRI bir çağrıda oluşturulur —
 * yalnızca zaten doğrulanmış installment.tenantId kullanılır, actor'ün
 * beyan ettiği hiçbir alan değil.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { studentId: string; installmentId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca veli kendi çocuğunun taksitini ödeyebilir" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
    const guardianRow = parentProfile
      ? await tx.studentGuardian.findUnique({
          where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
        })
      : null;
    if (!guardianRow || !guardianRow.isBillingResponsible) {
      return { kind: "forbidden" as const };
    }

    const installment = await tx.paymentInstallment.findUnique({ where: { id: params.installmentId } });
    if (!installment || installment.studentId !== student.id) return { kind: "not_found" as const };

    if (installment.status !== PaymentStatus.PENDING) {
      return { kind: "already_paid" as const, status: installment.status };
    }

    const updateResult = await tx.paymentInstallment.updateMany({
      where: { id: installment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID, paidAt: new Date(), providerTransactionId: `PARAMPOS-DEV-${Date.now()}` },
    });
    if (updateResult.count === 0) {
      return { kind: "already_paid" as const, status: PaymentStatus.PAID };
    }

    const updatedInstallment = await tx.paymentInstallment.findUniqueOrThrow({ where: { id: installment.id } });
    return { kind: "paid" as const, installment: updatedInstallment };
  });

  if (outcome.kind === "paid") {
    await prismaSuperadmin.accountingLedgerEntry.create({
      data: {
        tenantId: outcome.installment.tenantId,
        type: "GELIR",
        category: "Taksit Tahsilatı",
        amount: outcome.installment.amount,
        entryDate: new Date(),
        createdByUserId: actor.id,
        relatedInstallmentId: outcome.installment.id,
      },
    });
  }

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Taksit bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin faturalama sorumlusu velisi değilsiniz" }, { status: 403 });
  }
  if (outcome.kind === "already_paid") {
    return NextResponse.json({ message: `Bu taksit zaten "${outcome.status}" durumunda.` }, { status: 409 });
  }
  return NextResponse.json({ installment: outcome.installment });
}
