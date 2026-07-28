// Disiplin/Davranış Takibi modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (discipline
// migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET /api/branch/classrooms/:id/students — yetki, tenant izolasyonu.
//   2. GET/POST /api/branch/discipline — yetki, kategori doğrulaması (tür
//      bazlı geçerli kategori listesi), otomatik puan hesabı (+5/-5).
//   3. GET /api/students/:id/discipline — STUDENT yalnızca kendi kaydını,
//      PARENT yalnızca velisi olduğu öğrencinin kaydını, TEACHER/BRANCH_ADMIN
//      her öğrenciyi görebiliyor; netPoints doğru toplanıyor; tenant izolasyonu.
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
  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  if (!elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");
  const classroomId = elif.classroomId;

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!teacherCookie && !!branchAdminCookie && !!studentCookie && !!otherStudentCookie && !!parentCookie && !!cankayaCookie,
  );

  // ===== 1) GET /api/branch/classrooms/:id/students =====
  const noSessionRoster = await fetch(`${BASE}/api/branch/classrooms/${classroomId}/students`);
  check("GET classroom students: oturum yoksa 401 dönüyor", noSessionRoster.status === 401, noSessionRoster.status);

  const rosterRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}/students`, { headers: { Cookie: teacherCookie } });
  const rosterBody = await rosterRes.json();
  check("GET classroom students: 200 dönüyor", rosterRes.status === 200, rosterRes.status);
  check("GET classroom students: Elif listede", rosterBody.students?.some((s) => s.studentId === elif.id));

  const cankayaRoster = await fetch(`${BASE}/api/branch/classrooms/${classroomId}/students`, { headers: { Cookie: cankayaCookie } });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin sınıf listesini GÖREMİYOR (404)", cankayaRoster.status === 404, cankayaRoster.status);

  // ===== 2) POST /api/branch/discipline — doğrulama =====
  const noSessionPost = await fetch(`${BASE}/api/branch/discipline`, { method: "POST", body: JSON.stringify({}) });
  check("POST discipline: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const studentPost = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMLU", category: "Derse Katılım" }),
  });
  check("Yetki: STUDENT rolü disiplin kaydı ekleyemiyor (403)", studentPost.status === 403, studentPost.status);

  const invalidCategoryPost = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMLU", category: "Derse Geç Kalma" }), // bu OLUMSUZ kategorisi
  });
  check("POST discipline: türe uymayan kategori 400 dönüyor", invalidCategoryPost.status === 400, invalidCategoryPost.status);

  // ===== 3) POST /api/branch/discipline — başarılı oluşturma + otomatik puan =====
  const positiveRes = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMLU", category: "Derse Katılım", note: "Harika katılım" }),
  });
  const positiveBody = await positiveRes.json();
  check("POST discipline: OLUMLU kayıt 201 dönüyor", positiveRes.status === 201, positiveRes.status);
  check("Otomatik puan: OLUMLU +5", positiveBody.record?.points === 5, positiveBody.record?.points);

  const negativeRes = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMSUZ", category: "Ödev Yapmama" }),
  });
  const negativeBody = await negativeRes.json();
  check("POST discipline: OLUMSUZ kayıt 201 dönüyor", negativeRes.status === 201, negativeRes.status);
  check("Otomatik puan: OLUMSUZ -5", negativeBody.record?.points === -5, negativeBody.record?.points);

  const missingStudentPost = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: "does-not-exist", type: "OLUMLU", category: "Derse Katılım" }),
  });
  check("POST discipline: olmayan öğrenci için 404 dönüyor", missingStudentPost.status === 404, missingStudentPost.status);

  // ===== 4) GET /api/branch/discipline =====
  const listRes = await fetch(`${BASE}/api/branch/discipline?studentId=${elif.id}`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET discipline: 200 dönüyor ve iki kayıt listede", listRes.status === 200 && listBody.records?.length >= 2, listBody.records?.length);

  const cankayaList = await fetch(`${BASE}/api/branch/discipline?studentId=${elif.id}`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaList.json();
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kayıtlarını GÖREMİYOR", cankayaListBody.records?.length === 0);

  // ===== 5) GET /api/students/:id/discipline =====
  const noSessionStudentGet = await fetch(`${BASE}/api/students/${elif.id}/discipline`);
  check("GET student discipline: oturum yoksa 401 dönüyor", noSessionStudentGet.status === 401, noSessionStudentGet.status);

  const ownRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: studentCookie } });
  const ownBody = await ownRes.json();
  check("GET student discipline: STUDENT kendi kaydını görebiliyor (200)", ownRes.status === 200, ownRes.status);
  check("netPoints: +5 ve -5 toplamı 0", ownBody.netPoints === 0, ownBody.netPoints);
  check("records: iki kayıt da listede", ownBody.records?.length === 2, ownBody.records?.length);

  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in kayıtlarını GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: parentCookie } });
  check("GET student discipline: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const cankayaStudentRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaStudentRes.status === 404,
    cankayaStudentRes.status,
  );

  // Temizlik
  await prisma.disciplineRecord.delete({ where: { id: positiveBody.record.id } });
  await prisma.disciplineRecord.delete({ where: { id: negativeBody.record.id } });

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
