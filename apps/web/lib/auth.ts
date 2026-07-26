import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET tanımlı değil — apps/web/.env dosyasına ekleyin.");
}
// HS256 için makul bir alt sınır (256 bit'e yakın entropi için en az 32 karakter).
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET en az 32 karakter olmalıdır (yeterli entropi için) — bkz. apps/web/.env.example.");
}
// Prodüksiyonda bu depodaki dev-only placeholder'ın (veya benzer bariz
// zayıf değerlerin) yanlışlıkla kullanılmasını engeller. Üretimde JWT_SECRET
// bir secret yöneticisinden (AWS Secrets Manager, Vault, ...) enjekte
// edilmelidir — bkz. apps/web/.env.example.
if (process.env.NODE_ENV === "production") {
  const weakMarkers = ["dev-only", "changeme", "change-me", "secret", "example", "placeholder"];
  const lower = JWT_SECRET.toLowerCase();
  if (weakMarkers.some((marker) => lower.includes(marker))) {
    throw new Error(
      "JWT_SECRET, prodüksiyon için güvensiz görünen bir değer içeriyor (dev-only/örnek bir placeholder). " +
        "Üretimde gerçek bir secret yöneticisinden gelen, rastgele üretilmiş bir değer kullanın.",
    );
  }
}

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

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
