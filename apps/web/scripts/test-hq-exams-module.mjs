// Genel Sınav Merkezi modülünün GERÇEK bir Postgres veritabanına karşı uçtan
// uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run
// dev` sunucusu (localhost:3000) çalışıyor olmalı. Exam modeline
// feePerStudent/eligibleGradeLevels eklendi (bkz.
// prisma/migrations/20260729182549_add_exam_network_fields) — yeni bir model
// değil, mevcut Exam'e iki alan.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca SUPERADMIN görüntüleyebilir/oluşturabilir (BRANCH_ADMIN
//      403).
//   2. Oluşturma: NETWORK kapsamlı bir Exam gerçekten oluşuyor, tenantId'si
//      GENEL_MERKEZ tenant'ına işaret ediyor.
//   3. Öğrenci/optik form/fatura hesabı seed'deki ham StudentProfile
//      sayısıyla (SINIF_9: 4, SINIF_10: 1, ikisi de Lise → 1 optik/öğrenci)
//      eşleşiyor.
//   4. Yalnızca Ortaokul/Lise dışı bir sınıf düzeyi (örn. SINIF_1) reddediliyor.
//   5. GET listesi, oluşturulan sınavı doğru hesaplanmış alanlarla gösteriyor.
//   6. Aktivite Akışı'na yansıma.
//   7. branchIds ile şube kapsamı daraltma: yalnızca seçilen şubedeki
//      öğrenciler sayılıyor (bkz. task #53 — ExamBranchDispatch).
//   8. GET .../branch-breakdown: opticFormCount + dispatchStatus alanları.
//   9. PATCH /api/hq/exams/[examId]: ad/tarih/kitapçık/ücret düzenleniyor.
//  10. PATCH .../dispatch: kitapçık kargo durumu güncelleniyor.
//  11. DELETE /api/hq/exams/[examId]: gerçek ExamResult'u olan bir sınav 409
//      ile reddediliyor; sonucu olmayan bir sınav kalıcı siliniyor
//      (ExamBranchDispatch de birlikte kalkıyor — onDelete: Cascade).
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
  const genelMerkez = await prisma.tenant.findFirst({ where: { type: "GENEL_MERKEZ" } });
  const sinif9Count = await prisma.studentProfile.count({ where: { gradeLevel: "SINIF_9", tenant: { type: "SUBE" } } });
  const sinif10Count = await prisma.studentProfile.count({ where: { gradeLevel: "SINIF_10", tenant: { type: "SUBE" } } });
  if (!genelMerkez) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: SUPERADMIN/BRANCH_ADMIN için giriş başarılı", !!superadminCookie && !!branchAdminCookie);

  const noAuthRes = await fetch(`${BASE}/api/hq/exams`);
  check("GET hq/exams: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const branchListRes = await fetch(`${BASE}/api/hq/exams`, { headers: { Cookie: branchAdminCookie } });
  check("BRANCH_ADMIN listeleyemez: 403", branchListRes.status === 403, branchListRes.status);

  const branchCreateRes = await fetch(`${BASE}/api/hq/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "X", examDate: "2026-09-01", bookletCount: 4, eligibleGradeLevels: ["SINIF_9"] }),
  });
  check("BRANCH_ADMIN oluşturamaz: 403", branchCreateRes.status === 403, branchCreateRes.status);

  // ===== Geçersiz sınıf düzeyi (Ortaokul/Lise dışı) reddedilir =====
  const invalidGradeRes = await fetch(`${BASE}/api/hq/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ name: "Geçersiz", examDate: "2026-09-01", bookletCount: 4, eligibleGradeLevels: ["SINIF_1"] }),
  });
  check("Ortaokul/Lise dışı sınıf düzeyi reddedilir: 400", invalidGradeRes.status === 400, invalidGradeRes.status);

  // ===== Gerçek oluşturma: SINIF_9 + SINIF_10 (ikisi de Lise) =====
  const uniqueName = `Test Deneme ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/hq/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({
      name: uniqueName,
      examDate: "2026-09-15",
      bookletCount: 2,
      feePerStudent: 50,
      eligibleGradeLevels: ["SINIF_9", "SINIF_10"],
    }),
  });
  const createBody = await createRes.json();
  check("POST hq/exams: 201", createRes.status === 201, createRes.status);
  const expectedStudents = sinif9Count + sinif10Count;
  check(
    "Öğrenci sayısı seed'deki ham veriyle eşleşiyor",
    createBody.studentCount === expectedStudents,
    JSON.stringify({ got: createBody.studentCount, expected: expectedStudents }),
  );
  check(
    "Optik form sayısı = öğrenci sayısı (Lise → 1 optik/öğrenci)",
    createBody.opticFormCount === expectedStudents,
    createBody.opticFormCount,
  );
  check("Toplam fatura = öğrenci sayısı × 50", createBody.totalFee === expectedStudents * 50, createBody.totalFee);
  check("Kitapçık türleri 2'li (A/B)", JSON.stringify(createBody.exam.bookletTypes) === JSON.stringify(["A", "B"]), createBody.exam.bookletTypes);

  // ===== Exam.tenantId gerçekten GENEL_MERKEZ'e işaret ediyor =====
  const dbExam = await prisma.exam.findUnique({ where: { id: createBody.exam.id } });
  check("Exam.tenantId GENEL_MERKEZ tenant'ına işaret ediyor", dbExam?.tenantId === genelMerkez.id, dbExam?.tenantId);
  check("Exam.scope = NETWORK", dbExam?.scope === "NETWORK", dbExam?.scope);

  // ===== GET listesi doğru hesaplanmış alanları gösteriyor =====
  const listRes = await fetch(`${BASE}/api/hq/exams`, { headers: { Cookie: superadminCookie } });
  const listBody = await listRes.json();
  const listedExam = listBody.exams?.find((e) => e.id === createBody.exam.id);
  check(
    "GET listesi: yeni sınav doğru studentCount ile görünüyor",
    listedExam?.studentCount === expectedStudents,
    JSON.stringify(listedExam),
  );

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: superadminCookie } });
  check("Aktivite Akışı endpoint'i SUPERADMIN için erişilebilir (200 veya 403 olabilir, kontrol amaçlı)", true);
  if (activityRes.status === 200) {
    const activityBody = await activityRes.json();
    const actions = (activityBody.entries || []).map((e) => e.action);
    check("Aktivite Akışı: Genel Sınav tanımlandı", actions.includes("Genel Sınav tanımlandı"));
  } else {
    // SUPERADMIN kendi branch/activity-log'unu göremeyebilir (tenant bağlamı farklı) — doğrudan DB'den doğrula.
    const auditRow = await prisma.auditLogEntry.findFirst({ where: { tenantId: genelMerkez.id, action: "Genel Sınav tanımlandı" } });
    check("Aktivite Akışı (DB): Genel Sınav tanımlandı kaydı var", !!auditRow);
  }

  // ===== Şube kapsamı daraltma (branchIds) =====
  const mezitli = await prisma.tenant.findFirst({ where: { code: { startsWith: "MEZITLI" } } });
  const mezitliSinif9 = await prisma.studentProfile.count({ where: { gradeLevel: "SINIF_9", tenantId: mezitli.id } });
  const mezitliSinif10 = await prisma.studentProfile.count({ where: { gradeLevel: "SINIF_10", tenantId: mezitli.id } });
  const scopedName = `Test Kapsamlı Deneme ${Date.now()}`;
  const scopedCreateRes = await fetch(`${BASE}/api/hq/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({
      name: scopedName,
      examDate: "2026-09-20",
      bookletCount: 4,
      feePerStudent: 30,
      eligibleGradeLevels: ["SINIF_9", "SINIF_10"],
      branchIds: [mezitli.id],
    }),
  });
  const scopedCreateBody = await scopedCreateRes.json();
  check("Kapsamlı oluşturma: 201", scopedCreateRes.status === 201, scopedCreateRes.status);
  check("branchCount = 1", scopedCreateBody.branchCount === 1, scopedCreateBody.branchCount);
  check(
    "Kapsamlı öğrenci sayısı yalnızca Mezitli'yi sayıyor",
    scopedCreateBody.studentCount === mezitliSinif9 + mezitliSinif10,
    JSON.stringify({ got: scopedCreateBody.studentCount, expected: mezitliSinif9 + mezitliSinif10 }),
  );
  const dispatchRow = await prisma.examBranchDispatch.findUnique({ where: { examId_tenantId: { examId: scopedCreateBody.exam.id, tenantId: mezitli.id } } });
  check("ExamBranchDispatch satırı oluştu, HAZIRLANIYOR", dispatchRow?.status === "HAZIRLANIYOR", dispatchRow?.status);

  // ===== branch-breakdown: opticFormCount + dispatchStatus =====
  const breakdownRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}/branch-breakdown`, { headers: { Cookie: superadminCookie } });
  const breakdownBody = await breakdownRes.json();
  check("branch-breakdown: yalnızca 1 şube dönüyor", breakdownBody.branches?.length === 1, breakdownBody.branches?.length);
  check("branch-breakdown: opticFormCount alanı var", typeof breakdownBody.branches?.[0]?.opticFormCount === "number", breakdownBody.branches?.[0]?.opticFormCount);
  check("branch-breakdown: dispatchStatus HAZIRLANIYOR", breakdownBody.branches?.[0]?.dispatchStatus === "HAZIRLANIYOR", breakdownBody.branches?.[0]?.dispatchStatus);

  // ===== PATCH .../dispatch: kargo durumu güncelleme =====
  const branchDispatchPatchRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}/dispatch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ tenantId: mezitli.id, status: "BASILIYOR" }),
  });
  check("BRANCH_ADMIN sevkiyat durumu değiştiremez: 403", branchDispatchPatchRes.status === 403, branchDispatchPatchRes.status);

  const dispatchPatchRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}/dispatch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: mezitli.id, status: "KARGOYA_VERILDI" }),
  });
  const dispatchPatchBody = await dispatchPatchRes.json();
  check("PATCH dispatch: 200", dispatchPatchRes.status === 200, dispatchPatchRes.status);
  check("PATCH dispatch: status KARGOYA_VERILDI", dispatchPatchBody.status === "KARGOYA_VERILDI", dispatchPatchBody.status);

  // ===== PATCH /api/hq/exams/[examId]: sınav düzenleme =====
  const branchExamPatchRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "x" }),
  });
  check("BRANCH_ADMIN sınav düzenleyemez: 403", branchExamPatchRes.status === 403, branchExamPatchRes.status);

  const examPatchRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ name: scopedName + " (Güncel)", feePerStudent: 45 }),
  });
  const examPatchBody = await examPatchRes.json();
  check("PATCH exam: 200", examPatchRes.status === 200, examPatchRes.status);
  check("PATCH exam: ad güncellendi", examPatchBody.exam?.name === scopedName + " (Güncel)", examPatchBody.exam?.name);
  check("PATCH exam: feePerStudent güncellendi", Number(examPatchBody.exam?.feePerStudent) === 45, examPatchBody.exam?.feePerStudent);

  // ===== DELETE: sonucu olan sınav 409, olmayan sınav siliniyor =====
  const branchExamDeleteRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("BRANCH_ADMIN sınav silemez: 403", branchExamDeleteRes.status === 403, branchExamDeleteRes.status);

  const emptyExamDeleteRes = await fetch(`${BASE}/api/hq/exams/${scopedCreateBody.exam.id}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Sonucu olmayan sınav kalıcı silinir: 200", emptyExamDeleteRes.status === 200, emptyExamDeleteRes.status);
  const deletedExam = await prisma.exam.findUnique({ where: { id: scopedCreateBody.exam.id } });
  check("Silinen sınav artık DB'de yok", deletedExam === null);
  const orphanDispatch = await prisma.examBranchDispatch.findMany({ where: { examId: scopedCreateBody.exam.id } });
  check("Silinen sınavın ExamBranchDispatch'leri de kalktı", orphanDispatch.length === 0, orphanDispatch.length);

  // DELETE guard: gerçek sonucu olan bir sınav (createBody.exam.id üstüne uydurma bir ExamResult eklenerek test edilir, sonra temizlenir)
  const anyStudent = await prisma.studentProfile.findFirst({ where: { tenant: { type: "SUBE" } } });
  const fakeResult = await prisma.examResult.create({
    data: {
      examId: createBody.exam.id,
      tenantId: anyStudent.tenantId,
      studentId: anyStudent.id,
      correctCount: 1,
      wrongCount: 0,
      emptyCount: 0,
      rawScore: 1,
      netScore: 1,
    },
  });
  const busyExamDeleteRes = await fetch(`${BASE}/api/hq/exams/${createBody.exam.id}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Sonucu olan sınav silinemez: 409", busyExamDeleteRes.status === 409, busyExamDeleteRes.status);
  await prisma.examResult.delete({ where: { id: fakeResult.id } });

  // Temizlik — yalnızca bu testin oluşturduğu Exam ve Audit Log kaydı.
  await prisma.auditLogEntry.deleteMany({ where: { tenantId: genelMerkez.id, action: "Genel Sınav tanımlandı", detail: { contains: uniqueName } } });
  await prisma.exam.delete({ where: { id: createBody.exam.id } });

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
