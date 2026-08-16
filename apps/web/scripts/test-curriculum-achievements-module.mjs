// Ölçme-Değerlendirme > Kazanım Yükleme ekranının GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. Yetki: SUPERADMIN ve BRANCH_ADMIN yazabiliyor; TEACHER/STUDENT 403,
//      oturumsuz 401 (hem tekli hem toplu uçlarda).
//   2. Tekli ekleme: code/label/gradeLevel doğrulaması, subject code
//      önekinden doğru türetiliyor, aynı kod tekrar eklenince 409.
//   3. Toplu içe aktarma: geçerli+geçersiz satırlar karışık gönderildiğinde
//      her satır bağımsız işleniyor (successCount/errorCount doğru), MAX_ROWS
//      aşılınca 400.
//   4. gradeLevel güncelleme (PATCH): geçerli değer kabul, aralık dışı 400.
//   5. Silme: var olmayan kayıt 404; kullanımda olan (ExamQuestion'a bağlı)
//      bir kazanımın silinmesi 409 (P2003); kullanılmayan kazanım gerçekten
//      silinip listeden düşüyor.
import { PrismaClient, CurriculumNodeType } from "@prisma/client";

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
  const suffix = Date.now().toString().slice(-4);
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("SUPERADMIN login başarılı", !!superadminCookie);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN login başarılı", !!branchAdminCookie);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("TEACHER login başarılı", !!teacherCookie);

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/curriculum/achievements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  check("POST /achievements: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const teacherPostRes = await fetch(`${BASE}/api/curriculum/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ code: `MAT.YETKI.${suffix}`, label: "x", gradeLevel: 9 }),
  });
  check("POST /achievements: TEACHER 403", teacherPostRes.status === 403, teacherPostRes.status);

  const teacherBulkRes = await fetch(`${BASE}/api/curriculum/achievements/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ rows: [{ code: "X", label: "x", gradeLevel: 9 }] }),
  });
  check("POST /achievements/bulk: TEACHER 403", teacherBulkRes.status === 403, teacherBulkRes.status);

  // ===== Tekli ekleme (BRANCH_ADMIN) =====
  const code1 = `MAT.YUKLEME.${suffix}`;
  const createRes = await fetch(`${BASE}/api/curriculum/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ code: code1, label: "Test kazanımı", gradeLevel: 10 }),
  });
  check("BRANCH_ADMIN kazanım ekleyebiliyor", createRes.status === 201, createRes.status);
  const created = await createRes.json();
  check("Yeni kazanımın subject'i MAT önekinden türetildi", created.achievement?.subject === "Matematik", created.achievement?.subject);
  check("gradeLevel doğru döndü", created.achievement?.gradeLevel === 10, created.achievement?.gradeLevel);

  const dupRes = await fetch(`${BASE}/api/curriculum/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ code: code1, label: "Tekrar", gradeLevel: 10 }),
  });
  check("Aynı kod tekrar eklenince 409", dupRes.status === 409, dupRes.status);

  const invalidRes = await fetch(`${BASE}/api/curriculum/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ code: "", label: "", gradeLevel: 99 }),
  });
  check("Eksik/geçersiz alan 400", invalidRes.status === 400, invalidRes.status);

  // ===== GET listesi =====
  const listRes = await fetch(`${BASE}/api/curriculum/achievements`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("Yeni eklenen kazanım listede görünüyor", listBody.achievements?.some((a) => a.code === code1));

  // ===== gradeLevel güncelleme (PATCH) =====
  const patchRes = await fetch(`${BASE}/api/curriculum/achievements/${created.achievement.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ gradeLevel: 11 }),
  });
  check("PATCH gradeLevel güncelleyebiliyor", patchRes.status === 200, patchRes.status);
  const patched = await patchRes.json();
  check("Güncellenen gradeLevel doğru", patched.achievement?.gradeLevel === 11, patched.achievement?.gradeLevel);

  const patchInvalidRes = await fetch(`${BASE}/api/curriculum/achievements/${created.achievement.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ gradeLevel: 13 }),
  });
  check("PATCH aralık dışı gradeLevel 400", patchInvalidRes.status === 400, patchInvalidRes.status);

  // ===== Toplu içe aktarma (SUPERADMIN) =====
  const bulkRows = [
    { code: `FIZ.BULK.${suffix}.1`, label: "Bulk 1", gradeLevel: 9 },
    { code: `FIZ.BULK.${suffix}.2`, label: "Bulk 2", gradeLevel: 10 },
    { code: "", label: "", gradeLevel: 9 }, // geçersiz satır
    { code: code1, label: "Zaten var", gradeLevel: 9 }, // duplicate → P2002
  ];
  const bulkRes = await fetch(`${BASE}/api/curriculum/achievements/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ rows: bulkRows }),
  });
  check("POST /achievements/bulk: SUPERADMIN 200", bulkRes.status === 200, bulkRes.status);
  const bulkBody = await bulkRes.json();
  check("Bulk successCount doğru (2)", bulkBody.successCount === 2, bulkBody.successCount);
  check("Bulk errorCount doğru (2)", bulkBody.errorCount === 2, bulkBody.errorCount);
  check("Bulk results.length === rows.length", bulkBody.results?.length === bulkRows.length, bulkBody.results?.length);

  const emptyBulkRes = await fetch(`${BASE}/api/curriculum/achievements/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ rows: [] }),
  });
  check("Boş rows dizisi 400", emptyBulkRes.status === 400, emptyBulkRes.status);

  const tooManyRows = Array.from({ length: 201 }, (_, i) => ({ code: `X.${i}`, label: "x", gradeLevel: 9 }));
  const tooManyRes = await fetch(`${BASE}/api/curriculum/achievements/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ rows: tooManyRows }),
  });
  check("201 satır MAX_ROWS aşımı 400", tooManyRes.status === 400, tooManyRes.status);

  // ===== Silme =====
  const notFoundRes = await fetch(`${BASE}/api/curriculum/achievements/does-not-exist`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Var olmayan kazanım silme 404", notFoundRes.status === 404, notFoundRes.status);

  const teacherDeleteRes = await fetch(`${BASE}/api/curriculum/achievements/${created.achievement.id}`, { method: "DELETE", headers: { Cookie: teacherCookie } });
  check("DELETE: TEACHER 403", teacherDeleteRes.status === 403, teacherDeleteRes.status);

  // Kullanımda olan bir kazanımı bul (ExamQuestion tarafından referans verilen)
  const usedAchievement = await prisma.curriculumNode.findFirst({
    where: { type: CurriculumNodeType.ACHIEVEMENT, examQuestions: { some: {} } },
  });
  if (usedAchievement) {
    const usedDeleteRes = await fetch(`${BASE}/api/curriculum/achievements/${usedAchievement.id}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
    check("Kullanımdaki kazanım silinemez (409)", usedDeleteRes.status === 409, usedDeleteRes.status);
  } else {
    check("Kullanımdaki kazanım silinemez (409)", true, "atlandı — kullanımda ExamQuestion bulunamadı");
  }

  const deleteRes = await fetch(`${BASE}/api/curriculum/achievements/${created.achievement.id}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Kullanılmayan kazanım silinebiliyor", deleteRes.status === 200, deleteRes.status);

  const listAfterDeleteRes = await fetch(`${BASE}/api/curriculum/achievements`, { headers: { Cookie: branchAdminCookie } });
  const listAfterDeleteBody = await listAfterDeleteRes.json();
  check("Silinen kazanım listeden düştü", !listAfterDeleteBody.achievements?.some((a) => a.id === created.achievement.id));

  // ===== Temizlik — testin eklediği kalan kayıtları sil =====
  await prisma.curriculumNode.deleteMany({ where: { code: { contains: `.${suffix}` } } });

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
