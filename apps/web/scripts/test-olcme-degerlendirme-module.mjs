// Ölçme-Değerlendirme modülünün (app/api/branch/exams/*) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER sınav oluşturamaz ama görüntüleyebilir,
// oturumsuz 401), gerçek Exam(scope=BRANCH)+ExamQuestion oluşturma, roster'da
// hasResult takibi, cevap sayısı sınavdaki soru sayısıyla eşleşmezse red,
// net puan formülünün doğruluğu (doğru - yanlış/4), StudentAchievementResult'ın
// soru->kazanım eşlemesinden doğru hesaplanması, aynı öğrenci için tekrar
// girişte ESKİ kazanım satırlarının silinip YENİleriyle değiştirilmesi
// (çoğaltma değil), Kazanım Analizi özetinin gerçek veriden hesaplanması.
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
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  if (!elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie);

  const noSession = await fetch(`${BASE}/api/branch/exams`);
  check("GET exams: oturumsuz 401", noSession.status === 401, noSession.status);

  const achRes = await fetch(`${BASE}/api/curriculum/achievements`, { headers: { Cookie: branchCookie } });
  const achBody = await achRes.json();
  check("GET curriculum/achievements: 200 ve en az 2 kazanım", achRes.status === 200 && achBody.achievements?.length >= 2, achBody.achievements?.length);
  const [ach1, ach2] = achBody.achievements;

  const teacherCreateRes = await fetch(`${BASE}/api/branch/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ name: "x", examDate: "2026-01-01", questions: [{ achievementId: ach1.id }] }),
  });
  check("Yetki: TEACHER sınav oluşturamaz (403)", teacherCreateRes.status === 403, teacherCreateRes.status);

  const teacherViewRes = await fetch(`${BASE}/api/branch/exams`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER sınav listesini GÖRÜNTÜLEYEBİLİR (200)", teacherViewRes.status === 200, teacherViewRes.status);

  const uniqueName = `Test Sınav ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/branch/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ name: uniqueName, examDate: "2026-02-01", questions: [{ achievementId: ach1.id }, { achievementId: ach2.id }] }),
  });
  const createBody = await createRes.json();
  check("POST exams: 201 ve 2 soru", createRes.status === 201 && createBody.exam?.questionCount === 2, createBody);
  const examId = createBody.exam.id;

  const listRes = await fetch(`${BASE}/api/branch/exams`, { headers: { Cookie: branchCookie } });
  const listBody = await listRes.json();
  const listedExam = listBody.exams?.find((e) => e.id === examId);
  check("GET exams: yeni sınav listede, resultCount=0, avgNet=null", listedExam?.resultCount === 0 && listedExam?.avgNet === null, listedExam);

  const detailRes = await fetch(`${BASE}/api/branch/exams/${examId}`, { headers: { Cookie: branchCookie } });
  const detailBody = await detailRes.json();
  check("GET exam detail: 2 soru, kazanım kodlarıyla birlikte", detailBody.exam?.questions?.length === 2 && !!detailBody.exam.questions[0].achievementCode, detailBody.exam?.questions);
  const [q1, q2] = detailBody.exam.questions;

  const rosterRes = await fetch(`${BASE}/api/branch/exams/${examId}/results?classroomId=${elif.classroomId}`, { headers: { Cookie: branchCookie } });
  const rosterBody = await rosterRes.json();
  const elifRow = rosterBody.roster?.find((r) => r.studentId === elif.id);
  check("GET roster: Elif listede ve hasResult=false", elifRow?.hasResult === false, elifRow);

  const mismatchRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: true }] }),
  });
  check("POST results: eksik cevap sayısı reddediliyor (400)", mismatchRes.status === 400, mismatchRes.status);

  const teacherEnterRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: true }, { questionId: q2.id, isCorrect: true }] }),
  });
  check("Yetki: TEACHER sonuç giremez (403)", teacherEnterRes.status === 403, teacherEnterRes.status);

  const submitRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: true }, { questionId: q2.id, isCorrect: false }] }),
  });
  const submitBody = await submitRes.json();
  check(
    "POST results: 200 ve net puan doğru (1 doğru, 1 yanlış → 0.75)",
    submitRes.status === 200 && submitBody.netScore === 0.75 && submitBody.correctCount === 1 && submitBody.wrongCount === 1,
    submitBody,
  );

  const dbResult1 = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId, studentId: elif.id } },
    include: { achievementResults: true },
  });
  check("DB: ExamResult gerçek tenantId ile oluştu", dbResult1?.tenantId === elif.tenantId, dbResult1?.tenantId);
  check("DB: 2 StudentAchievementResult (her soru için bir kazanım)", dbResult1?.achievementResults.length === 2, dbResult1?.achievementResults.length);
  const correctAch = dbResult1?.achievementResults.find((r) => r.achievementId === ach1.id);
  const wrongAch = dbResult1?.achievementResults.find((r) => r.achievementId === ach2.id);
  check("DB: doğru cevaplanan kazanımın correctRatio=1", correctAch?.correctRatio === 1, correctAch?.correctRatio);
  check("DB: yanlış cevaplanan kazanımın correctRatio=0", wrongAch?.correctRatio === 0, wrongAch?.correctRatio);

  // Tekrar giriş — eski kazanım satırları ÇOĞALMAMALI, yenisiyle DEĞİŞMELİ.
  const resubmitRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: false }, { questionId: q2.id, isCorrect: false }] }),
  });
  const resubmitBody = await resubmitRes.json();
  check("POST results: tekrar giriş 200 ve net puan güncellendi (0 doğru → -0.5)", resubmitRes.status === 200 && resubmitBody.netScore === -0.5, resubmitBody);

  const dbResult2 = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId, studentId: elif.id } },
    include: { achievementResults: true },
  });
  check("DB: tekrar girişte HÂLÂ tam olarak 2 kazanım satırı var (çoğalmamış)", dbResult2?.achievementResults.length === 2, dbResult2?.achievementResults.length);
  check("DB: tekrar girişte her iki kazanım da correctRatio=0", dbResult2?.achievementResults.every((r) => r.correctRatio === 0), dbResult2?.achievementResults);

  const rosterAfterRes = await fetch(`${BASE}/api/branch/exams/${examId}/results?classroomId=${elif.classroomId}`, { headers: { Cookie: branchCookie } });
  const rosterAfterBody = await rosterAfterRes.json();
  const elifRowAfter = rosterAfterBody.roster?.find((r) => r.studentId === elif.id);
  check("GET roster: sonuç girildikten sonra hasResult=true", elifRowAfter?.hasResult === true && elifRowAfter?.netScore === -0.5, elifRowAfter);

  const summaryRes = await fetch(`${BASE}/api/branch/exams/achievement-summary`, { headers: { Cookie: branchCookie } });
  const summaryBody = await summaryRes.json();
  const summaryRow = summaryBody.achievements?.find((a) => a.achievementId === ach1.id);
  check("GET achievement-summary: yeni kazanım verimiz görünüyor", !!summaryRow, summaryRow);

  const listRes2 = await fetch(`${BASE}/api/branch/exams`, { headers: { Cookie: branchCookie } });
  const listBody2 = await listRes2.json();
  const listedExam2 = listBody2.exams?.find((e) => e.id === examId);
  check("GET exams: resultCount=1, avgNet=-0.5 olarak güncellendi", listedExam2?.resultCount === 1 && listedExam2?.avgNet === -0.5, listedExam2);

  const notFoundRes = await fetch(`${BASE}/api/branch/exams/does-not-exist/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [] }),
  });
  check("POST results: olmayan sınav için 404", notFoundRes.status === 404, notFoundRes.status);

  // ===== Temizlik =====
  await prisma.studentAchievementResult.deleteMany({ where: { examResultId: dbResult2.id } });
  await prisma.examResult.delete({ where: { id: dbResult2.id } });
  await prisma.examQuestion.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
  const remainingExam = await prisma.exam.findUnique({ where: { id: examId } });
  check("Temizlik: test sınavı kalmadı", remainingExam === null, remainingExam);

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
