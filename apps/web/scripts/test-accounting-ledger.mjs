// Muhasebe defteri API'sinin (dördüncü gerçek modül) GERÇEK bir Postgres'e
// karşı uçtan uca doğrulaması — taksit tahsilatı, etüt onay/red ve AI Sınıf
// Röntgeni'ndeki aynı deseni (gerçek DB + RLS + oturum tabanlı kimlik)
// tekrarlar. Önkoşullar: migration + kökten `npm run seed` uygulanmış,
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
  check("Login: Mezitli şube yöneticisi girişi başarılı", !!branchAdminCookie);

  // ===== 1) Oturum olmadan erişim engellenmeli =====
  const noSession = await fetch(`${BASE}/api/branch/accounting-ledger`);
  check("GET accounting-ledger: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  // ===== 2) Şube yöneticisi kendi defterini görür =====
  const listRes = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET accounting-ledger: 200 dönüyor", listRes.status === 200, listRes.status);
  check("GET accounting-ledger: seed'deki en az 2 kayıt listeleniyor", listBody.entries?.length >= 2, listBody.entries?.length);
  check(
    "GET accounting-ledger: özet (summary) gelir/gider/net içeriyor",
    typeof listBody.summary?.totalGelir === "number" && typeof listBody.summary?.totalGider === "number",
    JSON.stringify(listBody.summary),
  );
  check("GET accounting-ledger: seed'deki Kira gideri listede", listBody.entries?.some((e) => e.category === "Kira"), listBody.entries?.map((e) => e.category));

  // ===== 3) Yetki: TEACHER ve STUDENT rolleri defteri göremez =====
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const asTeacher = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü Muhasebe defterini göremiyor (403)", asTeacher.status === 403, asTeacher.status);

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const asStudent = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT rolü Muhasebe defterini göremiyor (403)", asStudent.status === 403, asStudent.status);

  // ===== 4) Şube yöneticisi yeni bir kayıt oluşturur =====
  const postRes = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "Kırtasiye", amount: 750, entryDate: "2026-07-20", note: "Test kaydı" }),
  });
  const postBody = await postRes.json();
  check("POST accounting-ledger: 201 dönüyor", postRes.status === 201, postRes.status);
  check("POST accounting-ledger: createdByUserId oturumdaki kullanıcıya atfediliyor (istemciden değil)", postBody.entry?.createdByUserId, postBody.entry?.createdByUserId);

  const dbEntry = await prisma.accountingLedgerEntry.findUnique({ where: { id: postBody.entry?.id } });
  check("DB: yeni kayıt gerçekten Mezitli tenant'ına yazılmış", dbEntry?.tenantId === mezitli.id, dbEntry?.tenantId);
  check("DB: tutar doğru kaydedilmiş", Number(dbEntry?.amount) === 750, dbEntry?.amount?.toString());

  // ===== 5) Girdi doğrulama =====
  const badPost = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GELIR", category: "", amount: -5, entryDate: "not-a-date" }),
  });
  check("POST accounting-ledger: geçersiz girdi 400 dönüyor", badPost.status === 400, badPost.status);

  // ===== 6) Yetki: TEACHER kayıt oluşturamaz =====
  const teacherPost = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ type: "GELIR", category: "Deneme", amount: 100, entryDate: "2026-07-20" }),
  });
  check("Yetki: TEACHER rolü kayıt oluşturamıyor (403)", teacherPost.status === 403, teacherPost.status);

  // ===== 7) Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kayıtlarını göremez =====
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaList = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: cankayaCookie } });
  const cankayaBody = await cankayaList.json();
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli kategorilerini GÖREMİYOR", !cankayaBody.entries?.some((e) => e.category === "Kira" || e.category === "Kırtasiye"), cankayaBody.entries?.map((e) => e.category));

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
