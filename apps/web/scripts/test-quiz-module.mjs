// Quiz / Pratik Modülü'nün GERÇEK bir Postgres veritabanına karşı uçtan
// uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (quiz attempts
// migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET /api/curriculum/achievements — oturum açık herhangi bir kullanıcı
//      erişebiliyor, MAT.9.1.2.3 gibi seed kazanımları listede.
//   2. POST /api/students/:id/quiz-attempts — yalnızca STUDENT (kendi) veya
//      PARENT (velisi olduğu öğrenci için) kaydedebiliyor; doğrulama
//      (correctCount > totalCount reddedilir, olmayan achievementId 404).
//   3. GET /api/students/:id/quiz-attempts — STUDENT kendi, PARENT velisi
//      olduğu öğrencinin denemelerini görebiliyor; tenant izolasyonu.
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
  const matAchievement = await prisma.curriculumNode.findUnique({ where: { code: "MAT.9.1.2.3" } });
  if (!elif || !matAchievement) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!studentCookie && !!otherStudentCookie && !!parentCookie && !!teacherCookie && !!cankayaCookie,
  );

  // ===== 1) GET /api/curriculum/achievements =====
  const noSessionAch = await fetch(`${BASE}/api/curriculum/achievements`);
  check("GET achievements: oturum yoksa 401 dönüyor", noSessionAch.status === 401, noSessionAch.status);

  const achRes = await fetch(`${BASE}/api/curriculum/achievements`, { headers: { Cookie: studentCookie } });
  const achBody = await achRes.json();
  check("GET achievements: 200 dönüyor ve MAT.9.1.2.3 listede", achRes.status === 200 && achBody.achievements?.some((a) => a.code === "MAT.9.1.2.3"));

  // ===== 2) POST /api/students/:id/quiz-attempts — doğrulama =====
  const noSessionPost = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, { method: "POST", body: JSON.stringify({}) });
  check("POST quiz-attempts: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const teacherPost = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ subject: "Matematik", correctCount: 3, totalCount: 5 }),
  });
  check("Yetki: TEACHER rolü quiz denemesi kaydedemiyor (403)", teacherPost.status === 403, teacherPost.status);

  const wrongChildPost = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: otherStudentCookie },
    body: JSON.stringify({ subject: "Matematik", correctCount: 3, totalCount: 5 }),
  });
  check("Yetki: başka bir STUDENT Elif için deneme kaydedemiyor (403)", wrongChildPost.status === 403, wrongChildPost.status);

  const invalidCorrectPost = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ subject: "Matematik", correctCount: 8, totalCount: 5 }),
  });
  check("POST quiz-attempts: correctCount > totalCount 400 dönüyor", invalidCorrectPost.status === 400, invalidCorrectPost.status);

  const missingAchievementPost = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ subject: "Matematik", achievementId: "does-not-exist", correctCount: 3, totalCount: 5 }),
  });
  check("POST quiz-attempts: olmayan achievementId 404 dönüyor", missingAchievementPost.status === 404, missingAchievementPost.status);

  // ===== 3) POST — başarılı oluşturma (STUDENT kendi + PARENT çocuğu için) =====
  const studentCreateRes = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ subject: "Matematik", achievementId: matAchievement.id, correctCount: 4, totalCount: 5 }),
  });
  const studentCreateBody = await studentCreateRes.json();
  check("POST quiz-attempts: STUDENT kendi denemesini kaydedebiliyor (201)", studentCreateRes.status === 201, studentCreateRes.status);

  const parentCreateRes = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ subject: "Fizik", correctCount: 2, totalCount: 5 }),
  });
  const parentCreateBody = await parentCreateRes.json();
  check("POST quiz-attempts: PARENT velisi olduğu öğrenci için kaydedebiliyor (201)", parentCreateRes.status === 201, parentCreateRes.status);

  // ===== 4) GET /api/students/:id/quiz-attempts =====
  const noSessionGet = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`);
  check("GET student quiz-attempts: oturum yoksa 401 dönüyor", noSessionGet.status === 401, noSessionGet.status);

  const ownGet = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, { headers: { Cookie: studentCookie } });
  const ownGetBody = await ownGet.json();
  check("GET student quiz-attempts: STUDENT kendi denemelerini görebiliyor (200)", ownGet.status === 200, ownGet.status);
  check("GET student quiz-attempts: iki deneme de listede", ownGetBody.attempts?.length === 2, ownGetBody.attempts?.length);
  check(
    "GET student quiz-attempts: en yeni deneme Fizik (PARENT'ın kaydı)",
    ownGetBody.attempts?.[0]?.subject === "Fizik",
    ownGetBody.attempts?.[0]?.subject,
  );
  check(
    "GET student quiz-attempts: Matematik denemesinde achievementLabel dolu",
    ownGetBody.attempts?.find((a) => a.subject === "Matematik")?.achievementLabel === "Rasyonel Sayılar",
  );

  const otherStudentGet = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in denemelerini GÖREMİYOR (403)", otherStudentGet.status === 403, otherStudentGet.status);

  const teacherGet = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, { headers: { Cookie: teacherCookie } });
  check("GET student quiz-attempts: personel (TEACHER) görebiliyor (200)", teacherGet.status === 200, teacherGet.status);

  const cankayaGet = await fetch(`${BASE}/api/students/${elif.id}/quiz-attempts`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaGet.status === 404,
    cankayaGet.status,
  );

  // Temizlik
  await prisma.quizAttempt.delete({ where: { id: studentCreateBody.attempt.id } });
  await prisma.quizAttempt.delete({ where: { id: parentCreateBody.attempt.id } });

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
