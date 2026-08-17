// task #110: Şube Sınav Uygulaması (Exam scope=BRANCH) sınavlarının Genel
// Sınav Merkezi'nde (app/api/hq/exams) de görünmesi — demo'daki tek global
// EXAMS listesinin karşılığı. GERÇEK bir Postgres veritabanına karşı uçtan
// uca doğrulama. Önkoşullar: kökte `npm run seed`, `npm run dev` çalışıyor
// olmalı. Oluşturduğu kaydı sonunda temizler.
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
  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!superadminCookie);

  const achievement = await prisma.curriculumNode.findFirst();
  check("Kurulum: en az bir kazanım (CurriculumNode) mevcut", !!achievement);

  const examName = `Test Şube Sınavı ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/branch/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({
      name: examName,
      examDate: "2026-09-15",
      type: "YAZILI",
      bookletCount: 2,
      eligibleGradeLevels: ["SINIF_9"],
      questions: [{ achievementId: achievement.id, correctAnswer: "A" }],
    }),
  });
  const createBody = await createRes.json();
  check("POST /api/branch/exams: 201 ile oluşturuldu", createRes.status === 201, createBody);
  const examId = createBody.exam?.id;

  const hqListRes = await fetch(`${BASE}/api/hq/exams`, { headers: { Cookie: superadminCookie } });
  const hqListBody = await hqListRes.json();
  check("GET /api/hq/exams: 200", hqListRes.status === 200, hqListRes.status);

  const crossoverRow = hqListBody.exams?.find((e) => e.id === examId);
  check("Genel Sınav Merkezi listesinde şube sınavı GÖRÜNÜYOR (çapraz kayıt)", !!crossoverRow, crossoverRow);
  check("Çapraz kayıt: scope=BRANCH olarak işaretli", crossoverRow?.scope === "BRANCH", crossoverRow?.scope);
  check("Çapraz kayıt: tenantName Mezitli'yi gösteriyor", !!crossoverRow?.tenantName, crossoverRow?.tenantName);
  check("Çapraz kayıt: branchCount=1 (kendi şubesi)", crossoverRow?.branchCount === 1, crossoverRow?.branchCount);

  // BRANCH sınavı HQ uçlarından düzenlenemez/silinemez (yalnızca NETWORK) — bilinçli kısıtlama.
  const patchRes = await fetch(`${BASE}/api/hq/exams/${examId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ name: "Değiştirilmeye çalışıldı" }),
  });
  check("PATCH /api/hq/exams/:id: BRANCH sınavı için 404 (yalnızca NETWORK düzenlenebilir)", patchRes.status === 404, patchRes.status);

  const deleteRes = await fetch(`${BASE}/api/hq/exams/${examId}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("DELETE /api/hq/exams/:id: BRANCH sınavı için 404 (yalnızca NETWORK silinebilir)", deleteRes.status === 404, deleteRes.status);

  const breakdownRes = await fetch(`${BASE}/api/hq/exams/${examId}/branch-breakdown`, { headers: { Cookie: superadminCookie } });
  check("GET branch-breakdown: BRANCH sınavı için 404 (ExamBranchDispatch'i yok)", breakdownRes.status === 404, breakdownRes.status);

  // ===== Temizlik =====
  if (examId) {
    await prisma.examQuestion.deleteMany({ where: { examId } });
    await prisma.exam.deleteMany({ where: { id: examId } });
  }
  const remaining = await prisma.exam.findFirst({ where: { name: examName } });
  check("Temizlik: test sınavı kalmadı", !remaining, remaining);

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
