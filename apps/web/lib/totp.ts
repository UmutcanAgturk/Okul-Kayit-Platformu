/**
 * TOTP (zamana dayalı tek kullanımlık şifre) yardımcıları — iki faktörlü
 * kimlik doğrulama için. Google Authenticator / Microsoft Authenticator / Authy
 * gibi standart uygulamalarla uyumludur (RFC 6238, 30sn periyot, 6 hane).
 *
 * `otplib` kullanılır. Doğrulamada `window: 1` verilir — kullanıcının telefonu
 * ile sunucu saati arasında ±30sn kayma tolere edilir (yaygın pratik).
 */
import { authenticator } from "otplib";
import QRCode from "qrcode";

// ±1 zaman adımı (±30sn) tolerans
authenticator.options = { window: 1 };

const ISSUER = "Seviye 360";

/** Yeni bir base32 TOTP gizli anahtarı üretir (kurulum başında). */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Authenticator uygulamasına eklenecek otpauth:// URI'si — QR olarak
 * gösterilir. `account`, kullanıcının uygulamada göreceği etikettir
 * (ör. e-posta veya ad-soyad).
 */
export function buildOtpAuthUrl(account: string, secret: string): string {
  return authenticator.keyuri(account, ISSUER, secret);
}

/** otpauth URI'sini taranabilir bir QR (data URL / PNG) haline getirir. */
export function otpAuthQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

/** Kullanıcının girdiği 6 haneli kodu, saklanan gizli anahtara karşı doğrular. */
export function verifyTotp(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    return authenticator.verify({ token: clean, secret });
  } catch {
    return false;
  }
}
