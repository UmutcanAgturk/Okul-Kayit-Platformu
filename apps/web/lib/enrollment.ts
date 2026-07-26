import crypto from "crypto";

/**
 * Normal Kayıt tamamlandığında öğrenciye otomatik kullanıcı adı/şifre üretir
 * (demo/seviye360-app.html'deki "otomatik kullanıcı adı/şifre" akışının
 * gerçek backend karşılığı, bkz. /api/branch/enrollments/[id]/complete).
 * Şifre yalnızca üretildiği anda düz metin olarak döner — asla saklanmaz,
 * yalnızca bcrypt hash'i User.passwordHash'e yazılır.
 */

const TURKISH_ASCII_MAP: Record<string, string> = {
  ı: "i", İ: "i", ğ: "g", Ğ: "g", ü: "u", Ü: "u",
  ş: "s", Ş: "s", ö: "o", Ö: "o", ç: "c", Ç: "c",
};

function slugifyTurkish(text: string): string {
  const ascii = text
    .split("")
    .map((ch) => TURKISH_ASCII_MAP[ch] ?? ch)
    .join("")
    .toLowerCase();
  return ascii
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // kalan aksanları (â, é, ...) at
    .replace(/[^a-z0-9\s.]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

export function generateStudentEmail(fullName: string, tenantCode: string): string {
  const local = slugifyTurkish(fullName) || "ogrenci";
  const domainTag = slugifyTurkish(tenantCode).replace(/\./g, "-") || "sube";
  return `${local}.${domainTag}@ogrenci.seviye360.com`;
}

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 0/O/1/l/I hariç

export function generateTempPassword(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

export function generateStudentNo(): string {
  // 6 haneli rastgele numara — seed'deki "201001" tarzı örneklerle aynı
  // biçimde, ama global @unique olduğu için çakışma ihtimaline karşı
  // çağıran taraf (bkz. complete/route.ts) P2002'de yeniden dener.
  return String(Math.floor(100000 + Math.random() * 900000));
}
