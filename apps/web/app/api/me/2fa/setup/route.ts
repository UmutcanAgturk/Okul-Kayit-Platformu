import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { generateTotpSecret, buildOtpAuthUrl, otpAuthQrDataUrl } from "@/lib/totp";

/**
 * İki faktörlü doğrulama kurulumunu BAŞLATIR (herhangi bir oturum açmış
 * kullanıcı — tüm roller için). Yeni bir gizli anahtar üretip kullanıcıya
 * yazar (totpEnabled hâlâ false), authenticator uygulamasına eklenecek QR'ı
 * (data URL) ve manuel giriş için gizli anahtarı döner. Kurulum, kullanıcı
 * /api/me/2fa/enable ile ilk kodu doğrulayana kadar TAMAMLANMIŞ SAYILMAZ.
 *
 * Zaten etkinse yeniden kuruluma izin verilmez (önce /api/me/2fa DELETE ile
 * kapatılmalı) — yanlışlıkla mevcut anahtarın ezilmesini önler.
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.totpEnabled) {
    return NextResponse.json({ message: "İki faktörlü doğrulama zaten etkin." }, { status: 409 });
  }

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: actor.id }, data: { totpSecret: secret, totpEnabled: false } });

  const account = actor.email || `${actor.firstName} ${actor.lastName}`;
  const otpauthUrl = buildOtpAuthUrl(account, secret);
  const qrDataUrl = await otpAuthQrDataUrl(otpauthUrl);

  return NextResponse.json({ secret, otpauthUrl, qrDataUrl });
}
