// Etüt modülünün demo denetiminde bulunan üç eksik parçasının GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması:
//   1. Öğrenci kendi etüt talebini oluşturabiliyor (POST /api/students/[id]/study-sessions)
//   2. Öğretmen onaylanmış bir seansı "Tamamlandı" olarak işaretleyebiliyor
//      (POST .../respond decision=COMPLETE)
//   3. BRANCH_ADMIN şubedeki TÜM etüt taleplerini görebiliyor/silebiliyor
//      (GET/DELETE /api/branch/study-sessions)
// Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu
// (localhost:3000) çalışıyor olmalı.
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
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const otherTeacherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!studentCookie && !!teacherCookie && !!branchAdminCookie && !!otherTeacherStudentCookie,
  );

  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const ayse = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const achievement = await prisma.curriculumNode.findFirst({ where: { code: "MAT.9.1.2.3" } });
  check("Seed verisi bulundu (öğrenci/öğretmen/kazanım)", !!elif && !!ayse && !!achievement);

  // ===== 1. Öğrenci kendi etüt talebini oluşturabiliyor =====
  const noAuthCreate = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacherId: ayse.id, achievementId: achievement.id, scheduledStart: "2026-09-01T15:00:00", scheduledEnd: "2026-09-01T15:40:00" }),
  });
  check("POST öğrenci talebi: oturumsuz 401", noAuthCreate.status === 401, noAuthCreate.status);

  const otherStudentCreate = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: otherTeacherStudentCookie },
    body: JSON.stringify({ teacherId: ayse.id, achievementId: achievement.id, scheduledStart: "2026-09-01T15:00:00", scheduledEnd: "2026-09-01T15:40:00" }),
  });
  check("Başka bir STUDENT Elif adına talep oluşturamaz: 403", otherStudentCreate.status === 403, otherStudentCreate.status);

  const invalidRangeRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ teacherId: ayse.id, achievementId: achievement.id, scheduledStart: "2026-09-01T15:40:00", scheduledEnd: "2026-09-01T15:00:00" }),
  });
  check("Geçersiz saat aralığı: 400", invalidRangeRes.status === 400, invalidRangeRes.status);

  const createRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ teacherId: ayse.id, achievementId: achievement.id, scheduledStart: "2026-09-01T15:00:00", scheduledEnd: "2026-09-01T15:40:00" }),
  });
  const createBody = await createRes.json();
  check("POST öğrenci talebi: 201 dönüyor", createRes.status === 201, createRes.status);
  check("Yeni talep AI_SUGGESTED (Onay Bekliyor) durumunda", createBody.session?.status === "AI_SUGGESTED", createBody.session?.status);
  const sessionId = createBody.session.id;

  const dbSession = await prisma.studySession.findUnique({ where: { id: sessionId } });
  check("DB: source=MANUAL (öğrenci talebi AI önerisi değil)", dbSession?.source === "MANUAL", dbSession?.source);

  const studentListRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, { headers: { Cookie: studentCookie } });
  const studentListBody = await studentListRes.json();
  check("Öğrenci kendi talebini listede görüyor", studentListBody.sessions?.some((s) => s.id === sessionId));

  // ===== Öğretmen onaylar =====
  const teacherListBefore = await fetch(`${BASE}/api/teacher/study-sessions`, { headers: { Cookie: teacherCookie } });
  const teacherListBeforeBody = await teacherListBefore.json();
  check("Öğretmen kendi listesinde yeni talebi görüyor", teacherListBeforeBody.sessions?.some((s) => s.id === sessionId));

  const approveRes = await fetch(`${BASE}/api/teacher/study-sessions/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Öğretmen onaylıyor: 200", approveRes.status === 200, approveRes.status);

  // ===== 2. Öğretmen "Tamamlandı" olarak işaretleyebiliyor =====
  const completeTooEarlyRes = await fetch(`${BASE}/api/teacher/study-sessions/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Zaten onaylanmış seansı tekrar onaylama: 409", completeTooEarlyRes.status === 409, completeTooEarlyRes.status);

  const completeRes = await fetch(`${BASE}/api/teacher/study-sessions/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "COMPLETE" }),
  });
  const completeBody = await completeRes.json();
  check("POST decision=COMPLETE: 200 dönüyor", completeRes.status === 200, completeRes.status);
  check("Seans COMPLETED durumuna geçti", completeBody.session?.status === "COMPLETED", completeBody.session?.status);

  const completeAgainRes = await fetch(`${BASE}/api/teacher/study-sessions/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "COMPLETE" }),
  });
  check("Zaten tamamlanmış seansı tekrar tamamlama: 409", completeAgainRes.status === 409, completeAgainRes.status);

  // AI_SUGGESTED durumundaki bir seansı doğrudan COMPLETE ile atlamaya çalışma
  const secondCreateRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ teacherId: ayse.id, achievementId: achievement.id, scheduledStart: "2026-09-02T15:00:00", scheduledEnd: "2026-09-02T15:40:00" }),
  });
  const secondCreateBody = await secondCreateRes.json();
  const skipApprovalRes = await fetch(`${BASE}/api/teacher/study-sessions/${secondCreateBody.session.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "COMPLETE" }),
  });
  check("Onaylanmamış (AI_SUGGESTED) bir seans doğrudan COMPLETE'e geçemez: 409", skipApprovalRes.status === 409, skipApprovalRes.status);

  // ===== 3. BRANCH_ADMIN şube genel bakışı =====
  const noAuthBranchList = await fetch(`${BASE}/api/branch/study-sessions`);
  check("GET branch study-sessions: oturumsuz 401", noAuthBranchList.status === 401, noAuthBranchList.status);

  const teacherBranchListRes = await fetch(`${BASE}/api/branch/study-sessions`, { headers: { Cookie: teacherCookie } });
  check("TEACHER şube genel bakışını göremez: 403", teacherBranchListRes.status === 403, teacherBranchListRes.status);

  const branchListRes = await fetch(`${BASE}/api/branch/study-sessions`, { headers: { Cookie: branchAdminCookie } });
  const branchListBody = await branchListRes.json();
  check("BRANCH_ADMIN: 200 dönüyor", branchListRes.status === 200, branchListRes.status);
  check("Tamamlanan seans genel bakışta görünüyor", branchListBody.sessions?.some((s) => s.id === sessionId && s.status === "COMPLETED"));
  check("İkinci (bekleyen) seans da genel bakışta görünüyor", branchListBody.sessions?.some((s) => s.id === secondCreateBody.session.id && s.status === "AI_SUGGESTED"));

  const teacherDeleteRes = await fetch(`${BASE}/api/branch/study-sessions/${secondCreateBody.session.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("TEACHER genel bakıştan silemez: 403", teacherDeleteRes.status === 403, teacherDeleteRes.status);

  const deleteRes = await fetch(`${BASE}/api/branch/study-sessions/${secondCreateBody.session.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("BRANCH_ADMIN siliyor: 200", deleteRes.status === 200, deleteRes.status);

  const branchListAfterDeleteRes = await fetch(`${BASE}/api/branch/study-sessions`, { headers: { Cookie: branchAdminCookie } });
  const branchListAfterDeleteBody = await branchListAfterDeleteRes.json();
  check("Silinen seans genel bakışta artık yok", !branchListAfterDeleteBody.sessions?.some((s) => s.id === secondCreateBody.session.id));

  // Temizlik
  await prisma.studySession.deleteMany({ where: { id: { in: [sessionId] } } });

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
