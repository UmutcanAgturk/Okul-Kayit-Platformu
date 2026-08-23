/**
 * Bildirim altyapısı — veli/öğrenciye SMS (Netgsm) ve e-posta (SMTP) gönderimi.
 *
 * Tasarım ilkeleri:
 *  - **Opt-in / zarif devre dışı**: İlgili ortam değişkenleri tanımlı değilse
 *    gönderim fonksiyonları hiçbir şey yapmadan `{ ok: false, skipped: true }`
 *    döner — yani üretime env eklenmeden hiçbir bildirim gitmez, test/CI
 *    ortamı da etkilenmez.
 *  - **En iyi çaba (best-effort)**: Gönderim hataları ASLA çağıran route'un
 *    ana işlemini (tahsilat, yoklama vb.) düşürmemelidir. Çağıran taraf bunu
 *    `try/catch` ile veya `void notify...()` ile ateşle-unut olarak kullanmalı.
 *  - **Tek hafif bağımlılık**: SMS için Netgsm'in HTTP API'si `fetch` ile
 *    (bağımlılıksız); e-posta için `nodemailer` (dinamik import — sadece SMTP
 *    yapılandırılmışsa yüklenir, aksi halde hiç çağrılmaz).
 *
 * Ortam değişkenleri (bkz. apps/web/.env.example):
 *   SMS
 *     NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_MSGHEADER
 *   E-POSTA (SMTP)
 *     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

export type NotifyResult = { ok: boolean; skipped?: boolean; error?: string; id?: string };

const SMS_ENABLED = () =>
  !!(process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD && process.env.NETGSM_MSGHEADER);

const EMAIL_ENABLED = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);

/** Türkiye cep numarasını Netgsm'in beklediği 10 haneli (5XXXXXXXXX) biçime indirger. */
export function normalizeTrMsisdn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // 10 hane ve 5 ile başlamalı (cep)
  if (d.length === 10 && d.startsWith("5")) return d;
  return null;
}

/**
 * Tek bir numaraya SMS gönderir. Netgsm "get" HTTP API'si kullanılır.
 * Yapılandırma yoksa `{ ok: false, skipped: true }` döner.
 */
export async function sendSms(to: string, message: string): Promise<NotifyResult> {
  if (!SMS_ENABLED()) return { ok: false, skipped: true };
  const msisdn = normalizeTrMsisdn(to);
  if (!msisdn) return { ok: false, error: "Geçersiz cep numarası" };

  const params = new URLSearchParams({
    usercode: process.env.NETGSM_USERCODE!,
    password: process.env.NETGSM_PASSWORD!,
    gsmno: msisdn,
    message,
    msgheader: process.env.NETGSM_MSGHEADER!,
    dil: "TR",
  });

  try {
    const res = await fetch("https://api.netgsm.com.tr/sms/send/get/?" + params.toString(), {
      method: "GET",
      // Netgsm bazen yavaş; makul bir üst sınır
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.text()).trim();
    // Netgsm başarı kodları "00" veya "01"/"02" ile başlayan "kod jobID" biçimindedir.
    const code = body.split(/\s+/)[0];
    if (code === "00" || code === "01" || code === "02") {
      return { ok: true, id: body.split(/\s+/)[1] };
    }
    return { ok: false, error: `Netgsm hata kodu: ${body}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS gönderilemedi" };
  }
}

/**
 * E-posta gönderir. `nodemailer` kuruluysa onunla SMTP üzerinden gönderir;
 * kurulu değilse veya yapılandırma yoksa atlanır.
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<NotifyResult> {
  if (!EMAIL_ENABLED()) return { ok: false, skipped: true };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "Geçersiz e-posta" };

  const nodemailer = await import("nodemailer");
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "E-posta gönderilemedi" };
  }
}

/**
 * Yüksek seviye yardımcı: bir alıcıya hem SMS hem e-posta dener (hangileri
 * yapılandırılmış ve mevcutsa). Route'lardan ateşle-unut çağrılmak üzere
 * tasarlandı — hata fırlatmaz.
 *
 * Örnek kullanım (bir route handler'ında, ana işlem commit olduktan SONRA):
 *
 *   import { notify } from "@/lib/notifications";
 *   // ... tahsilat başarıyla kaydedildikten sonra:
 *   void notify(
 *     { phone: parent.phone, email: parent.email },
 *     {
 *       sms: `Sn. ${parent.firstName}, ${amount}₺ taksit ödemeniz alınmıştır. Seviye 360`,
 *       emailSubject: "Ödeme Onayı — Seviye 360",
 *       emailText: `${amount}₺ tutarındaki taksit ödemeniz sistemimize işlenmiştir.`,
 *     },
 *   );
 *
 * `void` ile çağrıldığında yanıtı beklemez; gönderim arka planda ilerler ve
 * başarısız olsa bile route'un yanıtını etkilemez.
 */
export async function notify(
  recipient: { phone?: string | null; email?: string | null },
  content: { sms?: string; emailSubject?: string; emailText?: string; emailHtml?: string },
): Promise<{ sms?: NotifyResult; email?: NotifyResult }> {
  const out: { sms?: NotifyResult; email?: NotifyResult } = {};
  if (content.sms && recipient.phone) {
    out.sms = await sendSms(recipient.phone, content.sms);
  }
  if (content.emailSubject && content.emailText && recipient.email) {
    out.email = await sendEmail(recipient.email, content.emailSubject, content.emailText, content.emailHtml);
  }
  return out;
}
