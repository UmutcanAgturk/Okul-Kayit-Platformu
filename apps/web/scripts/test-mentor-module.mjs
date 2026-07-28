// Seviye Mentör modülünün GERÇEK bir Postgres veritabanına karşı uçtan uca
// doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı. Yeni Prisma modelleri ekler
// (TeacherProfile.isMentor, StudentProfile.mentorTeacherId, MentorRequest) —
// bkz. prisma/migrations/20260728164135_add_mentor ve .../..._add_mentor_rls.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN mentör havuzuna öğretmen ekleyebilir
//      (STUDENT/TEACHER 403); başka bir şubenin BRANCH_ADMIN'i bu şubenin
//      öğretmenini mentör yapamaz (404 — tenant izolasyonu).
//   2. Mentör havuzu boşken bir öğrencinin mentörünün null olduğu.
//   3. Bir öğretmen mentör havuzuna eklendiğinde, öğrenciye round-robin
//      otomatik atandığı (tek mentör olduğu için doğrudan ona).
//   4. Aylık kota: 9. Sınıf öğrencisi için kota=1, ilk talepten sonra ikinci
//      talebin 409 (kota doldu) döndüğü.
//   5. Mentör öğretmenin onay/red/tamamlandı akışı ve geçersiz geçişlerin
//      409 döndüğü.
//   6. Branch view'ın talebi doğru gösterdiği ve Aktivite Akışı'na yansıma.
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
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Mezitli) login başarılı", !!branchAdminCookie);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("TEACHER login başarılı", !!teacherCookie);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  check("STUDENT login başarılı", !!studentCookie);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  check("PARENT login başarılı", !!parentCookie);
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Çankaya) login başarılı", !!otherBranchAdminCookie);

  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const ayseTeacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });

  // ===== Mentör havuzu boşken =====
  const beforeRes = await fetch(`${BASE}/api/students/${elif.id}/mentor`, { headers: { Cookie: studentCookie } });
  const beforeBody = await beforeRes.json();
  check("GET mentor: havuz boşken mentor null", beforeBody.mentor === null, JSON.stringify(beforeBody.mentor));

  // ===== Yetki kontrolleri (mentör havuzu toggle) =====
  const noAuthToggleRes = await fetch(`${BASE}/api/branch/teachers/${ayseTeacher.id}/mentor`, { method: "POST" });
  check("POST mentor toggle: oturumsuz 401", noAuthToggleRes.status === 401, noAuthToggleRes.status);

  const studentToggleRes = await fetch(`${BASE}/api/branch/teachers/${ayseTeacher.id}/mentor`, { method: "POST", headers: { Cookie: studentCookie } });
  check("STUDENT toggle yapamaz: 403", studentToggleRes.status === 403, studentToggleRes.status);

  const otherBranchToggleRes = await fetch(`${BASE}/api/branch/teachers/${ayseTeacher.id}/mentor`, { method: "POST", headers: { Cookie: otherBranchAdminCookie } });
  check("Çankaya admin Mezitli öğretmenini mentör yapamaz: 404 (tenant izolasyonu)", otherBranchToggleRes.status === 404, otherBranchToggleRes.status);

  // ===== BRANCH_ADMIN mentör havuzuna ekler =====
  const toggleOnRes = await fetch(`${BASE}/api/branch/teachers/${ayseTeacher.id}/mentor`, { method: "POST", headers: { Cookie: branchAdminCookie } });
  const toggleOnBody = await toggleOnRes.json();
  check("BRANCH_ADMIN mentör havuzuna ekler: 200 + isMentor true", toggleOnRes.status === 200 && toggleOnBody.isMentor === true, toggleOnBody.isMentor);

  // ===== Otomatik atama =====
  const afterRes = await fetch(`${BASE}/api/students/${elif.id}/mentor`, { headers: { Cookie: studentCookie } });
  const afterBody = await afterRes.json();
  check("GET mentor: otomatik atandı", afterBody.mentor?.name === "Ayşe Demir", afterBody.mentor?.name);
  check("GET mentor: kota limiti 9. sınıf için 1", afterBody.quota?.limit === 1, afterBody.quota?.limit);
  check("GET mentor: kota kullanımı başlangıçta 0", afterBody.quota?.used === 0, afterBody.quota?.used);

  // ===== Randevu talebi (STUDENT) =====
  const requestedAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const createRes = await fetch(`${BASE}/api/students/${elif.id}/mentor-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ requestedAt, note: "Sınav kaygısı" }),
  });
  const createBody = await createRes.json();
  check("POST mentor-requests: 201 dönüyor", createRes.status === 201, createRes.status);
  const requestId = createBody.request?.id;

  // ===== Kota doldu (ikinci talep) =====
  const secondRes = await fetch(`${BASE}/api/students/${elif.id}/mentor-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ requestedAt: new Date(Date.now() + 5 * 86400000).toISOString() }),
  });
  check("İkinci talep: kota doldu 409", secondRes.status === 409, secondRes.status);

  // ===== Öğretmen gelen kutusu =====
  const teacherInboxRes = await fetch(`${BASE}/api/teacher/mentor-requests`, { headers: { Cookie: teacherCookie } });
  const teacherInboxBody = await teacherInboxRes.json();
  check(
    "Öğretmen gelen kutusunda talep BEKLIYOR olarak görünüyor",
    teacherInboxBody.requests?.some((r) => r.id === requestId && r.status === "BEKLIYOR"),
  );

  // ===== Geçersiz geçiş: BEKLIYOR'ken COMPLETE denemesi =====
  const invalidCompleteRes = await fetch(`${BASE}/api/teacher/mentor-requests/${requestId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "COMPLETE" }),
  });
  check("BEKLIYOR'ken COMPLETE geçersiz: 409", invalidCompleteRes.status === 409, invalidCompleteRes.status);

  // ===== Onayla =====
  const approveRes = await fetch(`${BASE}/api/teacher/mentor-requests/${requestId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("APPROVE: 200 dönüyor", approveRes.status === 200, approveRes.status);

  // ===== Tekrar onaylamaya çalışma =====
  const reApproveRes = await fetch(`${BASE}/api/teacher/mentor-requests/${requestId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Tekrar APPROVE: 409 (zaten karar verilmiş)", reApproveRes.status === 409, reApproveRes.status);

  // ===== Tamamlandı =====
  const completeRes = await fetch(`${BASE}/api/teacher/mentor-requests/${requestId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "COMPLETE" }),
  });
  check("COMPLETE: 200 dönüyor", completeRes.status === 200, completeRes.status);

  // ===== Branch view =====
  const branchViewRes = await fetch(`${BASE}/api/branch/mentor-requests`, { headers: { Cookie: branchAdminCookie } });
  const branchViewBody = await branchViewRes.json();
  const branchEntry = branchViewBody.requests?.find((r) => r.id === requestId);
  check("Branch view: talep TAMAMLANDI olarak görünüyor", branchEntry?.status === "TAMAMLANDI", branchEntry?.status);

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => e.action);
  check("Aktivite Akışı: mentör havuzuna eklendi", actions.includes("Mentör havuzuna eklendi"));
  check("Aktivite Akışı: randevu talep edildi", actions.includes("Mentör randevusu talep edildi"));
  check("Aktivite Akışı: randevu onaylandı", actions.includes("Mentör randevusu onaylandı"));
  check("Aktivite Akışı: randevu tamamlandı", actions.includes("Mentör randevusu tamamlandı"));

  // Temizlik
  await prisma.mentorRequest.deleteMany({ where: { studentId: elif.id } });
  await prisma.studentProfile.update({ where: { id: elif.id }, data: { mentorTeacherId: null } });
  await prisma.teacherProfile.update({ where: { id: ayseTeacher.id }, data: { isMentor: false } });
  await prisma.auditLogEntry.deleteMany({
    where: { action: { in: ["Mentör havuzuna eklendi", "Mentör havuzundan çıkarıldı", "Mentör randevusu talep edildi", "Mentör randevusu onaylandı", "Mentör randevusu tamamlandı", "Mentör randevusu reddedildi"] } },
  });

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
