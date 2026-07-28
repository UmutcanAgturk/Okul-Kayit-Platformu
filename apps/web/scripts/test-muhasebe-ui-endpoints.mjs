// Muhasebe modülünün ilk gerçek arayüzünü (apps/web/app/(branch)/muhasebe)
// çalıştırabilmek için eklenen iki YENİ endpoint'in uçtan uca doğrulaması:
// DELETE /api/branch/accounting-ledger/[entryId] ve GET /api/branch/teachers.
// Diğer tüm Muhasebe endpoint'leri (GET/POST ledger, vat-summary, installments,
// aging, payroll) zaten kendi test-*.mjs dosyalarında doğrulanıyor — burada
// tekrar edilmiyor. Önkoşullar: migration + kökten `npm run seed` uygulanmış,
// `npm run dev` çalışıyor olmalı.
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
  const mezitli = await prisma.tenant.findUnique({ where: { code: "MEZITLI-01" } });
  if (!mezitli) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: üç rol için de giriş başarılı", !!branchAdminCookie && !!teacherCookie && !!cankayaCookie);

  // ===== 1) GET /api/branch/teachers =====
  const noSession = await fetch(`${BASE}/api/branch/teachers`);
  check("GET teachers: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  const asTeacher = await fetch(`${BASE}/api/branch/teachers`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü öğretmen listesini göremiyor (403)", asTeacher.status === 403, asTeacher.status);

  const listRes = await fetch(`${BASE}/api/branch/teachers`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET teachers: 200 dönüyor", listRes.status === 200, listRes.status);
  check(
    "GET teachers: seed'deki Ayşe Demir listede",
    listBody.teachers?.some((t) => t.name === "Ayşe Demir"),
    listBody.teachers?.map((t) => t.name),
  );

  const cankayaTeachers = await fetch(`${BASE}/api/branch/teachers`, { headers: { Cookie: cankayaCookie } });
  const cankayaTeachersBody = await cankayaTeachers.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğretmenini GÖREMİYOR",
    !cankayaTeachersBody.teachers?.some((t) => t.name === "Ayşe Demir"),
    cankayaTeachersBody.teachers?.map((t) => t.name),
  );

  // ===== 2) DELETE /api/branch/accounting-ledger/[entryId] =====
  const createRes = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "Silme Testi", amount: 123, entryDate: "2026-07-20" }),
  });
  const createBody = await createRes.json();
  const entryId = createBody.entry?.id;
  check("Kurulum: silinecek test kaydı oluşturuldu", createRes.status === 201 && !!entryId, createRes.status);

  const noSessionDelete = await fetch(`${BASE}/api/branch/accounting-ledger/${entryId}`, { method: "DELETE" });
  check("DELETE accounting-ledger: oturum yoksa 401 dönüyor", noSessionDelete.status === 401, noSessionDelete.status);

  const teacherDelete = await fetch(`${BASE}/api/branch/accounting-ledger/${entryId}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Yetki: TEACHER rolü kayıt silemiyor (403)", teacherDelete.status === 403, teacherDelete.status);

  const cankayaDelete = await fetch(`${BASE}/api/branch/accounting-ledger/${entryId}`, {
    method: "DELETE",
    headers: { Cookie: cankayaCookie },
  });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kaydını silemiyor (404)",
    cankayaDelete.status === 404,
    cankayaDelete.status,
  );
  const stillThere = await prisma.accountingLedgerEntry.findUnique({ where: { id: entryId } });
  check("DB: yetkisiz silme denemesinden sonra kayıt hâlâ duruyor", !!stillThere);

  const missingDelete = await fetch(`${BASE}/api/branch/accounting-ledger/does-not-exist`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE accounting-ledger: olmayan id için 404 dönüyor", missingDelete.status === 404, missingDelete.status);

  const realDelete = await fetch(`${BASE}/api/branch/accounting-ledger/${entryId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE accounting-ledger: yetkili şube yöneticisi 200 alıyor", realDelete.status === 200, realDelete.status);

  const dbEntryAfter = await prisma.accountingLedgerEntry.findUnique({ where: { id: entryId } });
  check("DB: kayıt gerçekten silindi", dbEntryAfter === null);

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
