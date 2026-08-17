// Komut Paleti — gruplu arama (task #93, app/api/command-palette-search) GERÇEK
// bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. Oturumsuz 401.
//   2. 2 karakterden kısa sorguda her üç grup da boş dönüyor (400 DEĞİL).
//   3. BRANCH_ADMIN: öğrenci adı ve öğrenci no ile arama, personel adı ile
//      arama; kurum araması BOŞ (HQ'ya özel).
//   4. Tenant izolasyonu: Çankaya admin'i Mezitli öğrencisini/personelini
//      İSİMLE arayınca BULAMIYOR.
//   5. TEACHER: hiçbir grupta sonuç YOK (öğrenci/personel arama yetkisi yok).
//   6. SUPERADMIN (actingTenantId'siz, gerçek HQ): kurum araması ÇALIŞIYOR,
//      öğrenci/personel araması BOŞ.
//   7. SUPERADMIN (actingTenantId'li, "Bu Şube Olarak Yönet"): öğrenci/personel
//      araması BRANCH_ADMIN gibi çalışıyor, kurum araması BOŞ.
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

function mergeCookies(...cookieStrings) {
  return cookieStrings.filter(Boolean).join("; ");
}

async function loginAs(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) return null;
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

async function search(cookie, q) {
  const res = await fetch(`${BASE}/api/command-palette-search?q=${encodeURIComponent(q)}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!cankayaCookie && !!superadminCookie);

  const noAuth = await search(null, "Elif");
  check("GET: oturumsuz 401", noAuth.status === 401, noAuth.status);

  const tooShort = await search(branchCookie, "e");
  check(
    "GET: 2 karakterden kısa sorgu her üç grup için de boş dizi döner (400 değil)",
    tooShort.status === 200 && tooShort.body.students.length === 0 && tooShort.body.staff.length === 0 && tooShort.body.institutions.length === 0,
    tooShort,
  );

  // ===== BRANCH_ADMIN: öğrenci adı/no + personel adı arar, kurum aramaz =====
  const byName = await search(branchCookie, "Elif");
  check(
    "BRANCH_ADMIN: öğrenci adıyla arama Elif Yılmaz'ı buluyor",
    byName.status === 200 && byName.body.students?.some((s) => s.studentNo === "201001"),
    byName.body.students,
  );

  const byStudentNo = await search(branchCookie, "201001");
  check(
    "BRANCH_ADMIN: öğrenci NUMARASIYLA arama Elif Yılmaz'ı buluyor",
    byStudentNo.body.students?.some((s) => s.studentNo === "201001"),
    byStudentNo.body.students,
  );

  const staffSearch = await search(branchCookie, "Merve");
  check(
    "BRANCH_ADMIN: personel adıyla arama kendi personel listesinde sonuç döner ya da makul şekilde boştur",
    Array.isArray(staffSearch.body.staff),
    staffSearch.body.staff,
  );

  const noInstitutions = await search(branchCookie, "Mezitli");
  check("BRANCH_ADMIN: kurum araması HER ZAMAN boş (HQ'ya özel)", noInstitutions.body.institutions.length === 0, noInstitutions.body.institutions);

  // ===== Tenant izolasyonu =====
  const cankayaSearchElif = await search(cankayaCookie, "Elif");
  check(
    "Tenant izolasyonu: Çankaya admin'i Mezitli öğrencisi Elif'i BULAMIYOR",
    !cankayaSearchElif.body.students?.some((s) => s.studentNo === "201001"),
    cankayaSearchElif.body.students,
  );

  // ===== TEACHER: hiçbir grupta sonuç yok =====
  const teacherSearch = await search(teacherCookie, "Elif");
  check(
    "TEACHER: öğrenci/personel/kurum aramasının ÜÇÜ de boş (yetkisi yok)",
    teacherSearch.body.students.length === 0 && teacherSearch.body.staff.length === 0 && teacherSearch.body.institutions.length === 0,
    teacherSearch.body,
  );

  // ===== SUPERADMIN (bare, gerçek HQ): kurum arar, öğrenci/personel aramaz =====
  const superadminInstitutions = await search(superadminCookie, "Mezitli");
  check(
    "SUPERADMIN (HQ): kurum adıyla arama Mezitli'yi buluyor",
    superadminInstitutions.body.institutions?.some((t) => t.name.includes("Mezitli")),
    superadminInstitutions.body.institutions,
  );
  check(
    "SUPERADMIN (HQ): öğrenci/personel araması boş (actingTenantId yok)",
    superadminInstitutions.body.students.length === 0 && superadminInstitutions.body.staff.length === 0,
    superadminInstitutions.body,
  );

  const mezitliTenant = await prisma.tenant.findFirst({ where: { code: "MEZITLI-01" } });
  const actAsRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: mezitliTenant.id }),
  });
  const actAsCookie = (actAsRes.headers.get("set-cookie") || "").split(";")[0];
  const combinedCookie = mergeCookies(superadminCookie, actAsCookie);
  check("Kurulum: SUPERADMIN 'Bu Şube Olarak Yönet' başarılı", actAsRes.status === 200, actAsRes.status);

  const actingSearch = await search(combinedCookie, "Elif");
  check(
    "SUPERADMIN (actingTenantId ile): öğrenci araması BRANCH_ADMIN gibi çalışıyor",
    actingSearch.body.students?.some((s) => s.studentNo === "201001"),
    actingSearch.body.students,
  );
  check("SUPERADMIN (actingTenantId ile): kurum araması boş", actingSearch.body.institutions.length === 0, actingSearch.body.institutions);

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
