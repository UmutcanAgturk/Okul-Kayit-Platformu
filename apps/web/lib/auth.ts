import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Doğrulamayı bir IIFE içine alıp dönüş tipini `string` olarak sabitliyoruz —
// aksi halde TS, modül kapsamındaki bu narrowing'i aşağıdaki fonksiyonların
// (createSessionToken/verifySessionToken) gövdelerine taşımaz (kapatılan bir
// dış `const`'un tipi, onu kullanan fonksiyon bildirimleri için daralmış
// sayılmaz — TS'in bilinen bir sınırlaması).
const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET tanımlı değil — apps/web/.env dosyasına ekleyin.");
  }
  // HS256 için makul bir alt sınır (256 bit'e yakın entropi için en az 32 karakter).
  if (secret.length < 32) {
    throw new Error("JWT_SECRET en az 32 karakter olmalıdır (yeterli entropi için) — bkz. apps/web/.env.example.");
  }
  // Prodüksiyonda bu depodaki dev-only placeholder'ın (veya benzer bariz
  // zayıf değerlerin) yanlışlıkla kullanılmasını engeller. Üretimde JWT_SECRET
  // bir secret yöneticisinden (AWS Secrets Manager, Vault, ...) enjekte
  // edilmelidir — bkz. apps/web/.env.example.
  if (process.env.NODE_ENV === "production") {
    const weakMarkers = ["dev-only", "changeme", "change-me", "secret", "example", "placeholder"];
    const lower = secret.toLowerCase();
    if (weakMarkers.some((marker) => lower.includes(marker))) {
      throw new Error(
        "JWT_SECRET, prodüksiyon için güvensiz görünen bir değer içeriyor (dev-only/örnek bir placeholder). " +
          "Üretimde gerçek bir secret yöneticisinden gelen, rastgele üretilmiş bir değer kullanın.",
      );
    }
  }
  return secret;
})();

const SESSION_COOKIE_NAME = "seviye360_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 gün

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createSessionToken(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId }, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySessionToken(token: string): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

// İki faktörlü giriş ara-token'ı: şifre doğrulandıktan SONRA, TOTP kodu
// girilene kadar geçerli olan KISA ÖMÜRLÜ (5dk) bir token. Bu token TEK
// BAŞINA oturum açmaya yetmez — yalnızca "bu kullanıcı şifresini doğru girdi,
// şimdi ikinci faktörü bekliyoruz" durumunu taşır. `mfa: true` claim'i, bir
// oturum token'ının yanlışlıkla buraya geçmesini engeller.
const MFA_TOKEN_TTL_SECONDS = 5 * 60;

export function createMfaToken(userId: string): string {
  return jwt.sign({ sub: userId, mfa: true }, JWT_SECRET, { expiresIn: MFA_TOKEN_TTL_SECONDS });
}

export function verifyMfaToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (payload.mfa !== true || typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// İlk giriş zorunlu şifre değişimi ara-token'ı: şifre (ve varsa TOTP) doğru
// girildikten SONRA, kullanıcı `mustChangePassword` ise oturum HENÜZ açılmadan
// verilen KISA ÖMÜRLÜ (15dk) token. Tek başına oturum açmaya yetmez — yalnızca
// "bu kullanıcı kimliğini doğruladı, şimdi yeni şifre belirlemeli" durumunu
// taşır. `pwc: true` claim'i bir oturum/MFA token'ının buraya geçmesini engeller
// (bkz. app/api/auth/login/set-password).
const PW_CHANGE_TOKEN_TTL_SECONDS = 15 * 60;

export function createPasswordChangeToken(userId: string): string {
  return jwt.sign({ sub: userId, pwc: true }, JWT_SECRET, { expiresIn: PW_CHANGE_TOKEN_TTL_SECONDS });
}

export function verifyPasswordChangeToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (payload.pwc !== true || typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
