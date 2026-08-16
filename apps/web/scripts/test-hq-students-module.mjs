// Genel Merkez "Öğrenciler — Tüm Şubeler" ekranının GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
// Yeni bir Prisma modeli/migration EKLEMEZ — mevcut StudentProfile/Tenant/
// Classroom/ExamResult verisinden anlık envanter üretir (bkz.
// app/api/hq/students route'undaki not).
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca SUPERADMIN erişebiliyor (BRANCH_ADMIN 403, oturumsuz 401).
//   2. summary.totalStudents ham DB sayımıyla birebir eşleşiyor.
//   3. tenantId filtresi yalnızca o kurumun öğrencilerini döndürüyor.
//   4. q (arama) filtresi isimle doğru öğrenciyi buluyor.
//   5. Bilinen bir öğrencinin avgNet'i ham DB'deki ExamResult ortalamasıyla eşleşiyor.
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

  const totalStudentsDb = await prisma.studentProfile.count();
  const mezitli = await prisma.tenant.findFirst({ where: { code: "MEZITLI-01" } });
  const mezitliCountDb = await prisma.studentProfile.count({ where: { tenantId: mezitli.id } });
  const elif = await prisma.studentProfile.findFirst({
    where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } },
    include: { examResults: { select: { netScore: true } } },
  });
  const expectedAvgNet = Number((elif.examResults.reduce((s, r) => s + r.netScore, 0) / elif.examResults.length).toFixed(2));

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/hq/students`);
  check("GET /api/hq/students: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const branchAdminRes = await fetch(`${BASE}/api/hq/students`, { headers: { Cookie: branchAdminCookie } });
  check("GET /api/hq/students: BRANCH_ADMIN 403", branchAdminRes.status === 403, branchAdminRes.status);

  // ===== Genel liste =====
  const allRes = await fetch(`${BASE}/api/hq/students`, { headers: { Cookie: superadminCookie } });
  check("GET /api/hq/students: SUPERADMIN 200", allRes.status === 200, allRes.status);
  const allBody = await allRes.json();
  check("summary.totalStudents ham DB ile eşleşiyor", allBody.summary?.totalStudents === totalStudentsDb, `${allBody.summary?.totalStudents} vs ${totalStudentsDb}`);
  check("summary.branchCount en az 2", allBody.summary?.branchCount >= 2, allBody.summary?.branchCount);
  check("summary.busiestBranch dolu", !!allBody.summary?.busiestBranch?.name);

  // ===== tenantId filtresi =====
  const tenantFilterRes = await fetch(`${BASE}/api/hq/students?tenantId=${mezitli.id}`, { headers: { Cookie: superadminCookie } });
  const tenantFilterBody = await tenantFilterRes.json();
  check("tenantId filtresi: sadece Mezitli öğrencileri", tenantFilterBody.students?.length === mezitliCountDb, `${tenantFilterBody.students?.length} vs ${mezitliCountDb}`);
  check("tenantId filtresi: tüm satırlar Mezitli", tenantFilterBody.students?.every((s) => s.tenantName === mezitli.name));

  // ===== Arama (q) =====
  const searchRes = await fetch(`${BASE}/api/hq/students?q=elif`, { headers: { Cookie: superadminCookie } });
  const searchBody = await searchRes.json();
  const elifRow = searchBody.students?.find((s) => s.id === elif.id);
  check("q=elif araması Elif'i buluyor", !!elifRow, elifRow?.name);
  check("Arama sonucu yalnızca eşleşenleri içeriyor", searchBody.students?.every((s) => s.name.toLowerCase().includes("elif")));

  // ===== avgNet doğruluğu =====
  check("Elif'in avgNet'i ham DB ortalamasıyla eşleşiyor", elifRow?.avgNet === expectedAvgNet, `${elifRow?.avgNet} vs ${expectedAvgNet}`);
  check("Elif'in sınıfı 9-A olarak görünüyor", elifRow?.classroomName === "9-A", elifRow?.classroomName);

  // ===== Öğrenci detay çekmecesi için gereken alanlar (bkz. HqStudentsPanel + StudentDetailDrawer readOnly) =====
  check("Elif'in classroomId'si dolu (çekmece için gerekli)", !!elifRow?.classroomId, elifRow?.classroomId);
  check("Elif'in veli adı 'Hakan Yılmaz' olarak görünüyor", elifRow?.guardianName === "Hakan Yılmaz", elifRow?.guardianName);

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
