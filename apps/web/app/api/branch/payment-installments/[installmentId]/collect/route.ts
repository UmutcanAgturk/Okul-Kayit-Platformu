import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";
import { JournalSource } from "@prisma/client";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";
import { tryPostJournal } from "@/lib/accounting/posting";
import { ACC } from "@/lib/accounting/chart";

/**
 * Bir taksiti tahsil edilmiş olarak işaretler ve karşılığında bir Muhasebe
 * (AccountingLedgerEntry) kaydı oluşturur — demo artifact'ındaki (seviye360-app.html)
 * "Tahsilat Al" butonunun, Prisma'nın taksit-başına-satır modeliyle gerçek bir
 * veritabanına karşı çalışan karşılığı (bkz. demo/seviye360/PRISMA-UZLASMA.md,
 * madde 1).
 *
 * Güvenlik: kimlik artık istemcinin beyan ettiği bir alandan (eski
 * `collectedByUserId` body alanı) DEĞİL, /api/auth/login ile alınan imzalı
 * oturum çerezinden geliyor (bkz. lib/session.ts) — isteği yapan kişinin
 * gerçekten iddia ettiği kullanıcı olduğu artık kanıtlanıyor. Sorgular ayrıca
 * `withTenantContext` üzerinden, bu doğrulanmış kullanıcının VERİTABANINDAKİ
 * gerçek tenant/rol kaydıyla RLS bağlamı kurularak çalışır — başka bir
 * tenant'ın taksitini hedeflemeye çalışan bir istek, uygulama kodundaki bir
 * hataya rağmen bile veritabanı seviyesinde durdurulur (bkz. prisma/rls).
 *
 * Race condition koruması: `updateMany` ile koşullu güncelleme (yalnızca hâlâ
 * PENDING ise) atomik olarak yapılır — iki eşzamanlı istek aynı taksiti iki kez
 * tahsil edemez.
 */
const ROLES_ALLOWED_TO_COLLECT: UserRole[] = [UserRole.SUPERADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function POST(
  request: NextRequest,
  { params }: { params: { installmentId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
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
        createdByUserId: actor.id,
        relatedInstallmentId: installment.id,
      },
    });

    // Çift taraflı yevmiye kaydı (en iyi çaba, idempotent): eğitim geliri KDV
    // istisnası olduğundan tutarın tamamı 600'e; tahsilat 102 Bankalar'a.
    await tryPostJournal(tx, {
      tenantId: installment.tenantId,
      entryDate: new Date(),
      description: `Taksit tahsilatı — ${installment.installmentNo}. taksit`,
      source: JournalSource.TAHSILAT,
      sourceRefId: installment.id,
      createdByUserId: actor.id,
      lines: [
        { code: ACC.BANKALAR, debit: Number(installment.amount), description: "Tahsilat" },
        { code: ACC.SATISLAR, credit: Number(installment.amount), description: "Eğitim geliri" },
      ],
    });

    // 3. denetim bulgusu — demo'nun "Taksit tahsil edildi" olayının karşılığı
    // Aktivite Akışı'nda hiç yoktu (yalnızca AccountingLedgerEntry yazılıyordu).
    const student = await tx.studentProfile.findUnique({
      where: { id: installment.studentId },
      include: {
        user: true,
        // Fatura sorumlusu veliyi (yoksa ilk veliyi) bildirim için al
        guardians: { include: { parent: { include: { user: true } } } },
      },
    });
    await logActivity(tx, {
      tenantId: installment.tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Taksit tahsil edildi",
      detail: `${student?.user.firstName} ${student?.user.lastName} — ${installment.installmentNo}. taksit — ₺${installment.amount}`,
    });

    const billing = student?.guardians.find((g) => g.isBillingResponsible) ?? student?.guardians[0];
    const notifyTarget = billing
      ? { phone: billing.parent.user.phone, email: billing.parent.user.email, name: billing.parent.user.firstName }
      : student
        ? { phone: student.user.phone, email: student.user.email, name: student.user.firstName }
        : null;

    return {
      kind: "collected" as const,
      installment: updatedInstallment,
      ledgerEntry,
      notifyTarget,
      amount: installment.amount,
      installmentNo: installment.installmentNo,
      studentName: student ? `${student.user.firstName} ${student.user.lastName}` : "",
    };
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
  // Ana işlem (tahsilat + muhasebe kaydı) commit oldu. Bildirim EN İYİ ÇABA
  // ile, ateşle-unut gönderilir — SMS/e-posta yapılandırılmamışsa veya
  // gönderim başarısız olursa yanıt yine 200 döner (bkz. lib/notifications.ts).
  if (outcome.notifyTarget) {
    void notify(outcome.notifyTarget, {
      sms: `Sn. ${outcome.notifyTarget.name}, ${outcome.studentName} icin ${outcome.installmentNo}. taksit odemeniz (${outcome.amount} TL) alinmistir. Tesekkurler. Seviye 360`,
      emailSubject: "Ödeme Onayı — Seviye 360",
      emailText: `Sayın ${outcome.notifyTarget.name},

${outcome.studentName} adına ${outcome.installmentNo}. taksit ödemeniz (${outcome.amount} TL) sistemimize işlenmiştir.

Seviye 360 Eğitim Kurumları`,
    }).catch(() => {});
  }

  return NextResponse.json({ installment: outcome.installment, ledgerEntry: outcome.ledgerEntry }, { status: 200 });
}
