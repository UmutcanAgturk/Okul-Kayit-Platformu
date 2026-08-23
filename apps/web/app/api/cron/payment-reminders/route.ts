import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prismaSuperadmin } from "@/lib/prisma-superadmin";
import { notify } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

/**
 * Taksit vadesi hatırlatma cron'u. Oturumla DEĞİL, `CRON_SECRET` ile korunur —
 * sunucudaki bir cron job (veya harici bir zamanlayıcı) günde bir kez çağırır:
 *
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://360.seviye.com.tr/api/cron/payment-reminders
 *
 * Vadesine `REMIND_WINDOW_DAYS` (varsayılan 3) gün kalan VEYA vadesi geçmiş,
 * hâlâ PENDING taksitler için fatura sorumlusu veliye SMS/e-posta gönderir.
 * `reminderSentAt` ile aynı taksite 20 saatten sık hatırlatma yapılmaz
 * (cron günde bir çalışsa da elle tekrar tetiklense de güvenli).
 *
 * CRON_SECRET tanımlı değilse endpoint 503 döner (yanlışlıkla korumasız
 * açık kalmasını önler). Bildirim sağlayıcısı (Netgsm/SMTP) yapılandırılmamışsa
 * gönderim zaten sessizce atlanır (bkz. lib/notifications.ts), ama tarama yine
 * çalışır ve kaç taksitin hedeflendiğini raporlar.
 */
const REMIND_WINDOW_DAYS = Number(process.env.REMIND_WINDOW_DAYS ?? "3");
const MIN_HOURS_BETWEEN_REMINDERS = 20;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET tanımlı değil — endpoint devre dışı." }, { status: 503 });
  }
  const provided = request.headers.get("x-cron-secret");
  if (provided !== secret) {
    return NextResponse.json({ message: "Yetkisiz" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMIND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const minGap = new Date(now.getTime() - MIN_HOURS_BETWEEN_REMINDERS * 60 * 60 * 1000);

  // Tüm kurumlar genelinde (BYPASSRLS) vadesi yaklaşan/geçmiş, PENDING taksitler.
  const due = await prismaSuperadmin.paymentInstallment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      dueDate: { lte: windowEnd },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: minGap } }],
    },
    include: {
      student: {
        include: {
          user: true,
          guardians: { include: { parent: { include: { user: true } } } },
        },
      },
    },
    take: 500,
  });

  let sent = 0;
  let skipped = 0;
  for (const inst of due) {
    const billing = inst.student.guardians.find((g) => g.isBillingResponsible) ?? inst.student.guardians[0];
    const contact = billing ? billing.parent.user : inst.student.user;
    const studentName = `${inst.student.user.firstName} ${inst.student.user.lastName}`;
    const dueStr = inst.dueDate.toISOString().slice(0, 10);
    const overdue = inst.dueDate.getTime() < now.getTime();

    const res = await notify(
      { phone: contact.phone, email: contact.email },
      {
        sms: `Sn. ${contact.firstName}, ${studentName} icin ${inst.installmentNo}. taksit (${inst.amount} TL) ${overdue ? "vadesi gecti" : `son odeme ${dueStr}`}. Seviye 360`,
        emailSubject: `Taksit ${overdue ? "Gecikme" : "Hatırlatma"} — Seviye 360`,
        emailText: `Sayın ${contact.firstName},\n\n${studentName} adına ${inst.installmentNo}. taksit ödemeniz (${inst.amount} TL) ${overdue ? `${dueStr} tarihinde vadesi geçmiştir` : `için son ödeme tarihi ${dueStr}'dir`}.\n\nSeviye 360 Eğitim Kurumları`,
      },
    );

    void sendPushToUser(contact.id, overdue ? "Taksit Gecikme" : "Taksit Hatırlatma", `${studentName} ${inst.installmentNo}. taksit (${inst.amount} TL) ${overdue ? "vadesi geçti" : `son ödeme ${dueStr}`}.`, { type: "payment-reminder" }).catch(() => {});

    // Gönderim denendi (yapılandırma yoksa skipped döner ama yine de işaretleriz;
    // amaç aynı taramada tekrar tekrar denememek). Hiç iletişim bilgisi yoksa atla.
    if (contact.phone || contact.email) {
      await prismaSuperadmin.paymentInstallment.update({
        where: { id: inst.id },
        data: { reminderSentAt: now },
      });
      if (res.sms?.ok || res.email?.ok) sent++;
      else skipped++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ scanned: due.length, sent, skipped });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
