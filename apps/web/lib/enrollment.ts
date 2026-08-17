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

export function slugifyTurkish(text: string): string {
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

// Personel (Şube Müdürü/Ön Büro/Muhasebe/Rehber Öğretmen) için — bkz.
// /api/branch/staff. Öğrenci e-postalarından ayrı bir alan adı kullanır ki
// aynı isimdeki bir öğrenci ile personel e-postaları asla çakışmasın.
export function generateStaffEmail(fullName: string, tenantCode: string): string {
  const local = slugifyTurkish(fullName) || "personel";
  const domainTag = slugifyTurkish(tenantCode).replace(/\./g, "-") || "sube";
  return `${local}.${domainTag}@personel.seviye360.com`;
}

// Öğretmen (TeacherProfile) için — bkz. /api/branch/teachers POST (task #88).
// Personel/öğrenci e-postalarından ayrı bir alan adı kullanır (aynı desen —
// bkz. generateStaffEmail/generateStudentEmail).
export function generateTeacherEmail(fullName: string, tenantCode: string): string {
  const local = slugifyTurkish(fullName) || "ogretmen";
  const domainTag = slugifyTurkish(tenantCode).replace(/\./g, "-") || "sube";
  return `${local}.${domainTag}@ogretmen.seviye360.com`;
}

// Kayıt tamamlanırken veli için otomatik oluşturulan self-servis portal
// hesabı için (task #90) — bkz. /api/branch/enrollments/[id]/complete.
// Öğrenci/personel/öğretmen e-postalarından ayrı bir alan adı kullanır.
export function generateParentEmail(fullName: string, tenantCode: string): string {
  const local = slugifyTurkish(fullName) || "veli";
  const domainTag = slugifyTurkish(tenantCode).replace(/\./g, "-") || "sube";
  return `${local}.${domainTag}@veli.seviye360.com`;
}

// Yeni kurum eklerken otomatik oluşturulan Şube Yöneticisi hesabı için —
// bkz. /api/hq/tenants. Seed'deki BRANCH_ADMIN hesaplarıyla (ör.
// merve.aslan@seviye360.com) aynı üst düzey alan adını kullanır; öğrenci/
// personel e-postalarından (ayrı alt alan adları) bilinçli olarak farklıdır.
export function generateBranchAdminEmail(fullName: string, tenantCode: string): string {
  const local = slugifyTurkish(fullName) || "sube.muduru";
  const domainTag = slugifyTurkish(tenantCode).replace(/\./g, "-") || "sube";
  return `${local}.${domainTag}@seviye360.com`;
}

// Yeni kurum kodu üretir (ör. "MEZITLI-01") — şehir adından slug + iki
// haneli bir sıra numarası. Çağıran taraf (bkz. /api/hq/tenants)
// benzersizlik için DB'ye karşı döngüyle dener.
export function generateTenantCode(city: string, attempt: number): string {
  const base = slugifyTurkish(city).toUpperCase().replace(/\./g, "-") || "SUBE";
  return `${base}-${String(attempt).padStart(2, "0")}`;
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
