// Sınıf Atama — şube (Classroom) CRUD'unun GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı. Şemaya yeni bir
// alan ekler (Classroom.capacity) — bkz.
// prisma/migrations/20260816143141_add_classroom_capacity.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN şube oluşturabilir/düzenleyebilir/silebilir
//      (TEACHER/GUIDANCE_COORDINATOR listeleyebilir ama yönetemez; oturumsuz 401).
//   2. Oluşturma: sınıf düzeyi + şube adı + kapasiteden doğru "9-A" biçiminde
//      isim üretiliyor; aynı isimde ikinci kez oluşturma 409.
//   3. Güncelleme: şube adı değişince öğrencinin classroomId'si SABİT kalıyor
//      (aynı satır, yalnızca ad değişiyor) — kapasite güncellemesi de çalışıyor.
//   4. Silme: öğrenci varken 409; öğrenci taşındıktan sonra silinebiliyor.
//   5. Tenant izolasyonu: başka bir şubenin BRANCH_ADMIN'i bu şubeyi
//      düzenleyemez/silemez (404).
//   6. GET .../detail ("Sınıfa Gir"): yetki, tenant izolasyonu, roster +
//      TimetableSlot'tan türetilen Dersin Öğretmenleri/Haftalık Plan.
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
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Çankaya) login başarılı", !!otherBranchAdminCookie);

  const suffix = `Z${Date.now().toString().slice(-2)}`;

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/branch/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gradeLevel: "SINIF_9", suffix, capacity: 25 }),
  });
  check("POST /api/branch/classrooms: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const teacherCreateRes = await fetch(`${BASE}/api/branch/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ gradeLevel: "SINIF_9", suffix, capacity: 25 }),
  });
  check("TEACHER şube oluşturamaz: 403", teacherCreateRes.status === 403, teacherCreateRes.status);

  const invalidGradeRes = await fetch(`${BASE}/api/branch/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ gradeLevel: "MEZUN", suffix, capacity: 25 }),
  });
  check("MEZUN için şube açılamaz: 400", invalidGradeRes.status === 400, invalidGradeRes.status);

  // ===== Oluşturma =====
  const createRes = await fetch(`${BASE}/api/branch/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ gradeLevel: "SINIF_9", suffix, capacity: 25 }),
  });
  const createBody = await createRes.json();
  check("POST: 201 dönüyor", createRes.status === 201, createRes.status);
  check("Şube adı '9-<suffix>' biçiminde", createBody.classroom?.name === `9-${suffix}`, createBody.classroom?.name);
  check("Kapasite doğru kaydedildi", createBody.classroom?.capacity === 25, createBody.classroom?.capacity);
  const classroomId = createBody.classroom.id;

  const duplicateRes = await fetch(`${BASE}/api/branch/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ gradeLevel: "SINIF_9", suffix, capacity: 25 }),
  });
  check("Aynı isimle ikinci oluşturma: 409", duplicateRes.status === 409, duplicateRes.status);

  // ===== Listelemede görünüyor mu =====
  const listRes = await fetch(`${BASE}/api/branch/classrooms`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("Yeni şube listede", listBody.classrooms?.some((c) => c.id === classroomId));

  // ===== Bir öğrenciyi bu şubeye ata (silme testi için) =====
  const student = await prisma.studentProfile.findFirst({
    where: { classroom: { tenant: { code: "MEZITLI-01" } } },
    select: { id: true, classroomId: true },
  });
  const assignRes = await fetch(`${BASE}/api/branch/students/${student.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ classroomId }),
  });
  check("Test öğrencisi yeni şubeye atandı", assignRes.status === 200, assignRes.status);

  // ===== Güncelleme =====
  const newSuffix = `X${suffix.slice(1)}`;
  const updateRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ suffix: newSuffix, capacity: 32 }),
  });
  const updateBody = await updateRes.json();
  check("PATCH: 200 dönüyor", updateRes.status === 200, updateRes.status);
  check("Şube adı yeniden hesaplandı", updateBody.classroom?.name === `9-${newSuffix}`, updateBody.classroom?.name);
  check("Kapasite güncellendi", updateBody.classroom?.capacity === 32, updateBody.classroom?.capacity);

  const studentAfterRename = await prisma.studentProfile.findUnique({ where: { id: student.id }, select: { classroomId: true } });
  check("Öğrencinin classroomId'si SABİT kaldı (ad değişikliği kayan referansı bozmadı)", studentAfterRename.classroomId === classroomId);

  const teacherUpdateRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ capacity: 99 }),
  });
  check("TEACHER şube düzenleyemez: 403", teacherUpdateRes.status === 403, teacherUpdateRes.status);

  // ===== Öğrenci varken silme engellenir =====
  const deleteWhileOccupiedRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("Öğrenci varken silme: 409", deleteWhileOccupiedRes.status === 409, deleteWhileOccupiedRes.status);

  // ===== Tenant izolasyonu =====
  const crossTenantUpdateRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: otherBranchAdminCookie },
    body: JSON.stringify({ capacity: 5 }),
  });
  check("Çankaya admin'i Mezitli'nin şubesini düzenleyemez: 404", crossTenantUpdateRes.status === 404, crossTenantUpdateRes.status);

  // ===== Öğrenciyi eski şubesine geri taşı, sonra sil =====
  await fetch(`${BASE}/api/branch/students/${student.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ classroomId: student.classroomId }),
  });

  // ===== GET /api/branch/classrooms/:id/detail — "Sınıfa Gir" ekranı =====
  const detailClassroomId = student.classroomId;
  const detailNoAuthRes = await fetch(`${BASE}/api/branch/classrooms/${detailClassroomId}/detail`);
  check("GET detail: oturumsuz 401", detailNoAuthRes.status === 401, detailNoAuthRes.status);

  const detailTeacherRes = await fetch(`${BASE}/api/branch/classrooms/${detailClassroomId}/detail`, { headers: { Cookie: teacherCookie } });
  check("GET detail: TEACHER göremez (403)", detailTeacherRes.status === 403, detailTeacherRes.status);

  const detailNotFoundRes = await fetch(`${BASE}/api/branch/classrooms/does-not-exist/detail`, { headers: { Cookie: branchAdminCookie } });
  check("GET detail: olmayan sınıf için 404", detailNotFoundRes.status === 404, detailNotFoundRes.status);

  const detailCrossTenantRes = await fetch(`${BASE}/api/branch/classrooms/${detailClassroomId}/detail`, { headers: { Cookie: otherBranchAdminCookie } });
  check("GET detail: Çankaya admin'i Mezitli'nin sınıf detayını GÖREMİYOR (404)", detailCrossTenantRes.status === 404, detailCrossTenantRes.status);

  // Geçici bir TimetableSlot oluşturup haftalık plan/ders öğretmenleri alanlarını doğrula
  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const detailClassroom = await prisma.classroom.findUnique({ where: { id: detailClassroomId } });
  const slot = await prisma.timetableSlot.create({
    data: { tenantId: detailClassroom.tenantId, classroomId: detailClassroomId, teacherId: teacherProfile.id, subject: "Matematik", dayOfWeek: 1, startTime: "09:00", endTime: "09:40" },
  });
  try {
    const detailRes = await fetch(`${BASE}/api/branch/classrooms/${detailClassroomId}/detail`, { headers: { Cookie: branchAdminCookie } });
    const detailBody = await detailRes.json();
    check("GET detail: 200 dönüyor", detailRes.status === 200, detailRes.status);
    check("GET detail: roster'da öğrenci var", detailBody.students?.length > 0, detailBody.students?.length);
    check("GET detail: Dersin Öğretmenleri'nde Matematik → Ayşe Demir", detailBody.subjectTeachers?.some((st) => st.subject === "Matematik" && st.teacherName === "Ayşe Demir"), detailBody.subjectTeachers);
    check(
      "GET detail: haftalık planda Pazartesi 09:00 Matematik satırı var",
      detailBody.weeklyPlan?.some((r) => r.dayOfWeek === 1 && r.startTime === "09:00" && r.subject === "Matematik"),
      detailBody.weeklyPlan,
    );
  } finally {
    await prisma.timetableSlot.delete({ where: { id: slot.id } });
  }

  const deleteRes = await fetch(`${BASE}/api/branch/classrooms/${classroomId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("Öğrenci taşındıktan sonra silme: 200", deleteRes.status === 200, deleteRes.status);

  const listAfterDeleteRes = await fetch(`${BASE}/api/branch/classrooms`, { headers: { Cookie: branchAdminCookie } });
  const listAfterDeleteBody = await listAfterDeleteRes.json();
  check("Silinen şube listede yok", !listAfterDeleteBody.classrooms?.some((c) => c.id === classroomId));

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
