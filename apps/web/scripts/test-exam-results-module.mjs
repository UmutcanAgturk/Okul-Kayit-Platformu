// Öğrenci/Veli "Sınav Sonuçlarım" self-servis modülünün
// (app/api/students/[studentId]/exam-results) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (Karne/Devamsızlık ile birebir aynı desen —
// STUDENT yalnızca kendi kaydını, PARENT yalnızca velisi olduğu öğrencinin
// kaydını, TEACHER/BRANCH_ADMIN her öğrenciyi görebiliyor, tenant izolasyonu),
// sınav bazlı doğru/yanlış/boş + kazanım kırılımının seed verisiyle eşleştiği,
// achievementTrend'in yalnızca >=2 sınavda sorulan kazanımlar için oluştuğu.
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

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!studentCookie && !!otherStudentCookie && !!parentCookie && !!teacherCookie && !!branchCookie && !!cankayaCookie,
  );

  const noSession = await fetch(`${BASE}/api/students/${elif.id}/exam-results`);
  check("GET exam-results: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  const ownRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: studentCookie } });
  const ownBody = await ownRes.json();
  check("GET exam-results: STUDENT kendi sonuçlarını görebiliyor (200)", ownRes.status === 200, ownRes.status);
  check("Sınav geçmişi: '9. Sınıf Genel Deneme #4' listede", ownBody.examHistory?.some((e) => e.examName === "9. Sınıf Genel Deneme #4"));

  const seedExam = ownBody.examHistory?.find((e) => e.examName === "9. Sınıf Genel Deneme #4");
  check(
    "Sınav bazlı correctCount/wrongCount/emptyCount alanları mevcut",
    typeof seedExam?.correctCount === "number" && typeof seedExam?.wrongCount === "number" && typeof seedExam?.emptyCount === "number",
    seedExam,
  );
  const matAch = seedExam?.achievementBreakdown?.find((a) => a.subject === "Matematik" && a.correctRatio === 0.6);
  check(
    "Kazanım kırılımı: Matematik 0.6 correctRatio'lu kayıt WEAK olarak işaretli",
    matAch?.masteryLevel === "WEAK",
    matAch,
  );
  const turAch = seedExam?.achievementBreakdown?.find((a) => a.subject === "Türkçe");
  check("Kazanım kırılımı: Türkçe 1.0 correctRatio'lu kayıt STRONG olarak işaretli", turAch?.correctRatio === 1 && turAch?.masteryLevel === "STRONG", turAch);
  check(
    "Kazanım kırılımı en zayıftan güçlüye sıralı (ilk satır en düşük correctRatio)",
    seedExam?.achievementBreakdown?.[0]?.correctRatio <= seedExam?.achievementBreakdown?.[seedExam.achievementBreakdown.length - 1]?.correctRatio,
    seedExam?.achievementBreakdown,
  );
  check(
    "achievementTrend: tek sınavda sorulan kazanımlar (henüz 2. sınav yok) trend'de YOK",
    !ownBody.achievementTrend?.some((t) => seedExam?.achievementBreakdown?.some((a) => a.achievementId === t.achievementId)),
    ownBody.achievementTrend,
  );

  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in sonuçlarını GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: parentCookie } });
  check("GET exam-results: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const teacherRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: teacherCookie } });
  check("GET exam-results: TEACHER (personel) görebiliyor (200)", teacherRes.status === 200, teacherRes.status);

  const cankayaRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: cankayaCookie } });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)", cankayaRes.status === 404, cankayaRes.status);

  const missingRes = await fetch(`${BASE}/api/students/does-not-exist/exam-results`, { headers: { Cookie: teacherCookie } });
  check("GET exam-results: olmayan öğrenci için 404 dönüyor", missingRes.status === 404, missingRes.status);

  // ===== achievementTrend: bir kazanım İKİNCİ kez sorulunca trend'de belirmeli =====
  const matAchievement = await prisma.curriculumNode.findFirst({ where: { code: "MAT.9.2.1.1" } });
  const secondExam = await prisma.exam.create({
    data: {
      tenantId: elif.tenantId,
      name: `Test Trend Sınavı ${Date.now()}`,
      type: "DENEME",
      scope: "BRANCH",
      examDate: new Date("2026-08-01"),
      questions: { create: [{ orderIndex: 1, achievementId: matAchievement.id }] },
    },
    include: { questions: true },
  });
  try {
    const teacherProfile = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
    const slot = await prisma.timetableSlot.create({
      data: { tenantId: elif.tenantId, classroomId: elif.classroomId, teacherId: teacherProfile.id, subject: "Matematik", dayOfWeek: 4, startTime: "12:00", endTime: "12:40" },
    });
    try {
      const submitRes = await fetch(`${BASE}/api/branch/exams/${secondExam.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: teacherCookie },
        body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: secondExam.questions[0].id, isCorrect: true }] }),
      });
      check("Kurulum: ikinci sınav sonucu girildi (200)", submitRes.status === 200, submitRes.status);

      const afterRes = await fetch(`${BASE}/api/students/${elif.id}/exam-results`, { headers: { Cookie: studentCookie } });
      const afterBody = await afterRes.json();
      const trendRow = afterBody.achievementTrend?.find((t) => t.achievementId === matAchievement.id);
      check(
        "achievementTrend: MAT.9.2.1.1 artık 2 sınavda soruldu, trend'de 2 nokta var",
        trendRow?.points?.length === 2,
        trendRow,
      );
      check(
        "achievementTrend: noktalar kronolojik sırada (ilk sınav önce)",
        trendRow?.points?.[0]?.examName === "9. Sınıf Genel Deneme #4",
        trendRow?.points,
      );
    } finally {
      await prisma.timetableSlot.delete({ where: { id: slot.id } });
    }
  } finally {
    await prisma.studentAchievementResult.deleteMany({ where: { examResult: { examId: secondExam.id } } });
    await prisma.examResult.deleteMany({ where: { examId: secondExam.id } });
    await prisma.examQuestion.deleteMany({ where: { examId: secondExam.id } });
    await prisma.exam.delete({ where: { id: secondExam.id } });
  }

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
