// Kurum Yönetimi'nin (hq:kurumlar SALT OKUNUR karşılığı) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
// Yeni bir Prisma modeli/migration EKLEMEZ — mevcut Tenant/StudentProfile/
// TeacherProfile/StaffProfile/Classroom/User verisinden anlık kurum envanteri
// üretir (bkz. app/api/hq/tenants route'undaki not).
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca SUPERADMIN erişebiliyor (BRANCH_ADMIN 403, oturumsuz 401).
//   2. Seed'deki 3 tenant'ın (Genel Merkez, Mezitli, Çankaya) doğru
//      tip/şehir/öğrenci sayısıyla listede yer aldığı (ham DB sayımıyla
//      birebir eşleştirilerek).
//   3. Mezitli tenant'ının BRANCH_ADMIN'inin (Merve Aslan) doğru göründüğü.
//   4. Zaten var olan /api/hq/accounting-ledger'ın (Superadmin konsolide
//      görünüm) 200 döndüğü ve grandTotal.net = toplam gelir - toplam gider
//      tutarlılığının korunduğu (yeni endpoint'in dolaylı regresyon testi).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public" } },
});
const BASE = "http://localhost:3000";
const SEED_DEV_PASSWORD = "seviye360dev-pw";
const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}${detail !== undefined ? " — " + detail : ""}`);
};

async function loginAs(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) return null;
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

async function main() {
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("SUPERADMIN login başarılı", !!superadminCookie);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN login başarılı", !!branchAdminCookie);

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/hq/tenants`);
  check("GET /api/hq/tenants: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const branchAdminRes = await fetch(`${BASE}/api/hq/tenants`, { headers: { Cookie: branchAdminCookie } });
  check("GET /api/hq/tenants: BRANCH_ADMIN 403", branchAdminRes.status === 403, branchAdminRes.status);

  // ===== Ham DB sayımı (beklenen değerler) =====
  const [mezitliStudentCount, cankayaStudentCount, mezitliClassroomCount] = await Promise.all([
    prisma.studentProfile.count({ where: { tenant: { code: "MEZITLI-01" } } }),
    prisma.studentProfile.count({ where: { tenant: { code: "CANKAYA-01" } } }),
    prisma.classroom.count({ where: { tenant: { code: "MEZITLI-01" } } }),
  ]);

  // ===== Kurum listesi =====
  const res = await fetch(`${BASE}/api/hq/tenants`, { headers: { Cookie: superadminCookie } });
  check("GET /api/hq/tenants: SUPERADMIN 200", res.status === 200, res.status);
  const body = await res.json();
  check("tenants dizisi 3 kurum içeriyor", body.tenants?.length === 3, body.tenants?.length);

  const genelMerkez = body.tenants.find((t) => t.code === "GENEL-MERKEZ");
  const mezitli = body.tenants.find((t) => t.code === "MEZITLI-01");
  const cankaya = body.tenants.find((t) => t.code === "CANKAYA-01");

  check("Genel Merkez tipi doğru", genelMerkez?.type === "GENEL_MERKEZ", genelMerkez?.type);
  check("Mezitli tipi SUBE", mezitli?.type === "SUBE", mezitli?.type);
  check("Mezitli şehri Mersin", mezitli?.city === "Mersin", mezitli?.city);
  check("Mezitli öğrenci sayısı ham DB ile eşleşiyor", mezitli?.studentCount === mezitliStudentCount, `${mezitli?.studentCount} vs ${mezitliStudentCount}`);
  check("Mezitli sınıf sayısı ham DB ile eşleşiyor", mezitli?.classroomCount === mezitliClassroomCount, `${mezitli?.classroomCount} vs ${mezitliClassroomCount}`);
  check("Mezitli şube müdürü Merve Aslan", mezitli?.branchAdminName === "Merve Aslan", mezitli?.branchAdminName);
  // task #105 (3. denetim) — branchAdminEmail (kullanıcı adı) artık dönüyor
  check("Mezitli şube müdürü kullanıcı adı doğru", mezitli?.branchAdminEmail === "merve.aslan@seviye360.com", mezitli?.branchAdminEmail);
  check("Çankaya öğrenci sayısı ham DB ile eşleşiyor", cankaya?.studentCount === cankayaStudentCount, `${cankaya?.studentCount} vs ${cankayaStudentCount}`);
  check("Çankaya şube müdürü Onur Kaya", cankaya?.branchAdminName === "Onur Kaya", cankaya?.branchAdminName);
  check("Çankaya şube müdürü kullanıcı adı doğru", cankaya?.branchAdminEmail === "onur.kaya@seviye360.com", cankaya?.branchAdminEmail);

  // ===== Zaten var olan konsolide muhasebe görünümü (regresyon) =====
  const ledgerRes = await fetch(`${BASE}/api/hq/accounting-ledger`, { headers: { Cookie: superadminCookie } });
  check("GET /api/hq/accounting-ledger: SUPERADMIN 200 (regresyon)", ledgerRes.status === 200, ledgerRes.status);
  const ledgerBody = await ledgerRes.json();
  const expectedNet = ledgerBody.grandTotal?.totalGelir - ledgerBody.grandTotal?.totalGider;
  check(
    "accounting-ledger: grandTotal.net tutarlı",
    Math.abs(ledgerBody.grandTotal?.net - expectedNet) < 0.001,
    ledgerBody.grandTotal?.net,
  );

  console.log("\n=== ÖZET ===");
  const fails = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  return fails.length;
}

main()
  .then(async (failCount) => {
    await prisma.$disconnect();
    process.exit(failCount ? 1 : 0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
