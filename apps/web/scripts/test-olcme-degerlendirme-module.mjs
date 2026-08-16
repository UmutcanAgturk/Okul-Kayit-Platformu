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
// TEACHER'ın SADECE kendi Ders Programı'ndaki (TimetableSlot) sınıflar için
// sonuç girebildiği, başka bir sınıf için giremediği (bkz. teacherOwnsClassroom).
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

  // Henüz Ders Programı'nda kaydı yokken TEACHER, Elif'in sınıfı için sonuç GİREMEMELİ.
  const teacherEnterNoSlotRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: true }, { questionId: q2.id, isCorrect: true }] }),
  });
  check("Yetki: kendi sınıfı OLMAYAN bir TEACHER sonuç giremez (403)", teacherEnterNoSlotRes.status === 403, teacherEnterNoSlotRes.status);

  // Şimdi öğretmeni Elif'in sınıfının Ders Programı'na ekle — artık sonuç girebilmeli.
  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const slot = await prisma.timetableSlot.create({
    data: { tenantId: elif.tenantId, classroomId: elif.classroomId, teacherId: teacherProfile.id, subject: "Matematik", dayOfWeek: 2, startTime: "10:00", endTime: "10:40" },
  });
  const teacherEnterRes = await fetch(`${BASE}/api/branch/exams/${examId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, answers: [{ questionId: q1.id, isCorrect: true }, { questionId: q2.id, isCorrect: true }] }),
  });
  check("Yetki: KENDİ sınıfındaki TEACHER sonuç girebilir (200)", teacherEnterRes.status === 200, teacherEnterRes.status);

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

  // ===== Durum/Kazanım sekmeleri — task #64 =====
  const activeStudentCount = await prisma.studentProfile.count({ where: { user: { isActive: true, tenantId: elif.tenantId } } });
  const expectedParticipationPct = activeStudentCount > 0 ? Math.round((1 / activeStudentCount) * 100) : null;
  check(
    "GET exams: yeni sınavın participationPct'i (1 sonuç / aktif öğrenci sayısı) ile eşleşiyor",
    listedExam2?.participationPct === expectedParticipationPct,
    { got: listedExam2?.participationPct, expected: expectedParticipationPct, activeStudentCount },
  );
  check(
    "GET exams: correctCount/wrongCount/emptyCount/correctRatePct alanları mevcut (0 doğru, 2 yanlış → %0 doğru oranı)",
    listedExam2?.correctCount === 0 && listedExam2?.wrongCount === 2 && listedExam2?.correctRatePct === 0,
    listedExam2,
  );

  const summaryRes2 = await fetch(`${BASE}/api/branch/exams/achievement-summary`, { headers: { Cookie: branchCookie } });
  const summaryBody2 = await summaryRes2.json();
  check(
    "GET achievement-summary: distribution (critical/weak/strong) alanları mevcut",
    typeof summaryBody2.distribution?.critical === "number" &&
      typeof summaryBody2.distribution?.weak === "number" &&
      typeof summaryBody2.distribution?.strong === "number",
    summaryBody2.distribution,
  );
  check(
    "GET achievement-summary: bySubject dizisi mevcut ve her satır avgMasteryPct/achievementCount/distribution içeriyor",
    Array.isArray(summaryBody2.bySubject) &&
      summaryBody2.bySubject.length > 0 &&
      typeof summaryBody2.bySubject[0].avgMasteryPct === "number" &&
      typeof summaryBody2.bySubject[0].achievementCount === "number" &&
      typeof summaryBody2.bySubject[0].distribution?.critical === "number",
    summaryBody2.bySubject?.[0],
  );
  // resubmitRes her iki kazanımı da correctRatio=0 (CRITICAL) yaptı — genel dağılımda en az 2 kritik olmalı.
  check("GET achievement-summary: distribution.critical en az 2 (testin ürettiği 2 kritik kayıt)", summaryBody2.distribution?.critical >= 2, summaryBody2.distribution);

  const atRiskAllRes = await fetch(`${BASE}/api/branch/exams/at-risk-students`, { headers: { Cookie: branchCookie } });
  const atRiskAllBody = await atRiskAllRes.json();
  const elifAtRisk = atRiskAllBody.students?.find((s) => s.studentId === elif.id);
  check(
    "GET at-risk-students (filtresiz): Elif kritik kazanımlarıyla (ach1, ach2) listede",
    elifAtRisk?.criticalAchievements?.some((a) => a.achievementId === ach1.id) && elifAtRisk?.criticalAchievements?.some((a) => a.achievementId === ach2.id),
    elifAtRisk,
  );

  const atRiskFilteredRes = await fetch(`${BASE}/api/branch/exams/at-risk-students?achievementId=${ach1.id}`, { headers: { Cookie: branchCookie } });
  const atRiskFilteredBody = await atRiskFilteredRes.json();
  const elifAtRiskFiltered = atRiskFilteredBody.students?.find((s) => s.studentId === elif.id);
  check(
    "GET at-risk-students?achievementId=ach1: Elif listede, yalnızca ach1 kritik kazanımı gösteriliyor",
    elifAtRiskFiltered?.criticalAchievements?.length === 1 && elifAtRiskFiltered?.criticalAchievements?.[0]?.achievementId === ach1.id,
    elifAtRiskFiltered,
  );

  const noSessionAtRisk = await fetch(`${BASE}/api/branch/exams/at-risk-students`);
  check("GET at-risk-students: oturumsuz 401", noSessionAtRisk.status === 401, noSessionAtRisk.status);
  const teacherAtRisk = await fetch(`${BASE}/api/branch/exams/at-risk-students`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER at-risk-students'ı görüntüleyebilir (200)", teacherAtRisk.status === 200, teacherAtRisk.status);

  // ===== Temizlik =====
  await prisma.studentAchievementResult.deleteMany({ where: { examResultId: dbResult2.id } });
  await prisma.examResult.delete({ where: { id: dbResult2.id } });
  await prisma.examQuestion.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
  const remainingExam = await prisma.exam.findUnique({ where: { id: examId } });
  check("Temizlik: test sınavı kalmadı", remainingExam === null, remainingExam);
  await prisma.timetableSlot.delete({ where: { id: slot.id } });

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
