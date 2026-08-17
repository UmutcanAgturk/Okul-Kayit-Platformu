// Öğretmen ekleme/düzenleme (TeacherProfile CRUD, task #88) modülünün
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı. Personel'in (StaffProfile, bkz. test-staff-module.mjs)
// aynı deseni tekrarlar — TeacherProfile'ın StaffProfile'dan farkı: kendi
// tenantId'si yok (bkz. app/api/branch/teachers/route.ts yorumu), salary/
// department/startDate/status yok (branch/title/isMentor var), ve kalıcı
// silmeden önce ÇOK daha fazla ilişki sayılır (mentee/timetable/pta/club/
// studysession/payroll/mentorrequest — bkz. [teacherId]/route.ts).
//
// Kontrol ettikleri:
//   1. GET /api/branch/teachers?full=true — yetki, tenant izolasyonu, Pasif
//      öğretmenlerin de listelendiği (varsayılan GET'in aksine).
//   2. GET /api/branch/teachers (mevcut, full=true OLMADAN) — davranış
//      DEĞİŞMEDİ: hâlâ yalnızca aktif öğretmenleri, minimal alanlarla döner.
//   3. POST /api/branch/teachers — doğrulama, oluşturma, GERÇEK giriş,
//      özel e-posta + duplicate 409.
//   4. PATCH /api/branch/teachers/:id — profil (branch/title/phone/isMentor),
//      kullanıcı adı değişimi, yeniden aktifleştirme, duplicate phone 409,
//      tenant izolasyonu (404).
//   5. DELETE (varsayılan) — deaktivasyon (silme değil).
//   6. DELETE ?permanent=true — geçmişi (TimetableSlot) olan öğretmen 409
//      ile reddediliyor, olmayan öğretmen gerçekten kalıcı siliniyor.
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
  const mezitli = await prisma.tenant.findUnique({ where: { code: "MEZITLI-01" } });
  const cankaya = await prisma.tenant.findUnique({ where: { code: "CANKAYA-01" } });
  if (!mezitli || !cankaya) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: üç rol için de giriş başarılı", !!branchAdminCookie && !!teacherCookie && !!cankayaCookie);

  // ===== 1) GET /api/branch/teachers?full=true =====
  const noSessionFull = await fetch(`${BASE}/api/branch/teachers?full=true`);
  check("GET teachers?full=true: oturum yoksa 401 dönüyor", noSessionFull.status === 401, noSessionFull.status);

  const teacherFullList = await fetch(`${BASE}/api/branch/teachers?full=true`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü tam öğretmen listesini göremiyor (403)", teacherFullList.status === 403, teacherFullList.status);

  const fullListBefore = await fetch(`${BASE}/api/branch/teachers?full=true`, { headers: { Cookie: branchAdminCookie } });
  const fullListBeforeBody = await fullListBefore.json();
  check("GET teachers?full=true: 200 dönüyor", fullListBefore.status === 200, fullListBefore.status);
  check(
    "GET teachers?full=true: seed'deki Ayşe Demir e-posta/telefon alanlarıyla listede",
    fullListBeforeBody.teachers?.some((t) => t.name === "Ayşe Demir" && "email" in t && "isActive" in t),
  );
  const countBefore = fullListBeforeBody.teachers?.length ?? 0;

  // ===== 2) GET /api/branch/teachers (full=true OLMADAN) — davranış değişmedi =====
  const minimalList = await fetch(`${BASE}/api/branch/teachers`, { headers: { Cookie: branchAdminCookie } });
  const minimalListBody = await minimalList.json();
  check("GET teachers (minimal): 200 dönüyor", minimalList.status === 200, minimalList.status);
  check(
    "GET teachers (minimal): yalnızca {id,name,branch,isMentor} alanları var (email/isActive YOK)",
    minimalListBody.teachers?.length > 0 && !("email" in minimalListBody.teachers[0]) && !("isActive" in minimalListBody.teachers[0]),
    minimalListBody.teachers?.[0],
  );

  // ===== 3) POST /api/branch/teachers — doğrulama =====
  const noSessionCreate = await fetch(`${BASE}/api/branch/teachers`, { method: "POST", body: JSON.stringify({}) });
  check("POST teachers: oturum yoksa 401 dönüyor", noSessionCreate.status === 401, noSessionCreate.status);

  const teacherCreateAttempt = await fetch(`${BASE}/api/branch/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ fullName: "Test Öğretmen", branch: "Matematik" }),
  });
  check("Yetki: TEACHER rolü öğretmen oluşturamıyor (403)", teacherCreateAttempt.status === 403, teacherCreateAttempt.status);

  const invalidCreate = await fetch(`${BASE}/api/branch/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "", branch: "" }),
  });
  check("POST teachers: eksik alanlar 400 dönüyor", invalidCreate.status === 400, invalidCreate.status);

  // ===== 4) POST /api/branch/teachers — başarılı oluşturma + gerçek giriş =====
  const createRes = await fetch(`${BASE}/api/branch/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "Test Kimya Öğretmeni", branch: "Kimya", title: "Zümre Başkanı", phone: "05557778899" }),
  });
  const createBody = await createRes.json();
  const teacherId = createBody.teacher?.id;
  check("POST teachers: 201 dönüyor ve öğretmen oluşturuluyor", createRes.status === 201 && !!teacherId, createRes.status);
  check("POST teachers: giriş bilgileri (username/password) döndü", !!createBody.credentials?.username && !!createBody.credentials?.password);

  const dbTeacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
  check("DB: TeacherProfile doğru tenant'ta ve TEACHER rolünde oluşturuldu", dbTeacher?.user.tenantId === mezitli.id && dbTeacher?.user.role === "TEACHER");
  check("DB: branch/title doğru kaydedildi", dbTeacher?.branch === "Kimya" && dbTeacher?.title === "Zümre Başkanı");

  const newTeacherCookie = await loginAs(createBody.credentials.username, createBody.credentials.password);
  check("Yeni öğretmen döndürülen kullanıcı adı/şifresiyle GERÇEKTEN giriş yapabiliyor", !!newTeacherCookie);

  const fullListAfterCreate = await fetch(`${BASE}/api/branch/teachers?full=true`, { headers: { Cookie: branchAdminCookie } });
  const fullListAfterCreateBody = await fullListAfterCreate.json();
  check("GET teachers?full=true: yeni öğretmen listede görünüyor", fullListAfterCreateBody.teachers?.length === countBefore + 1);

  // ===== 5) Tenant izolasyonu =====
  const cankayaFullList = await fetch(`${BASE}/api/branch/teachers?full=true`, { headers: { Cookie: cankayaCookie } });
  const cankayaFullListBody = await cankayaFullList.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin yeni öğretmenini GÖREMİYOR",
    !cankayaFullListBody.teachers?.some((t) => t.name === "Test Kimya Öğretmeni"),
  );

  const cankayaPatchAttempt = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ title: "Hacklendi" }),
  });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğretmenini düzenleyemiyor (404)", cankayaPatchAttempt.status === 404, cankayaPatchAttempt.status);

  const cankayaDeactivateAttempt = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, { method: "DELETE", headers: { Cookie: cankayaCookie } });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğretmenini devre dışı bırakamıyor (404)", cankayaDeactivateAttempt.status === 404, cankayaDeactivateAttempt.status);
  const stillActiveAfterCrossTenant = await prisma.user.findUnique({ where: { id: dbTeacher.userId } });
  check("DB: yetkisiz denemeden sonra öğretmen hâlâ aktif", stillActiveAfterCrossTenant?.isActive === true);

  // ===== 6) PATCH /api/branch/teachers/:id — profil düzenleme =====
  const teacherPatchAttempt = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ title: "Yeni Unvan" }),
  });
  check("Yetki: TEACHER rolü öğretmen profilini düzenleyemiyor (403)", teacherPatchAttempt.status === 403, teacherPatchAttempt.status);

  const profilePatchRes = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ branch: "Fizik", title: "Bölüm Sorumlusu", phone: "05551112233", isMentor: true }),
  });
  const profilePatchBody = await profilePatchRes.json();
  check("PATCH profil: 200 dönüyor", profilePatchRes.status === 200, profilePatchRes.status);
  check("PATCH profil: branş güncellendi", profilePatchBody.teacher?.branch === "Fizik", profilePatchBody.teacher?.branch);
  check("PATCH profil: isMentor güncellendi", profilePatchBody.teacher?.isMentor === true, profilePatchBody.teacher?.isMentor);

  const secondTeacherRes = await fetch(`${BASE}/api/branch/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "Test İkinci Öğretmen", branch: "Tarih", phone: "05559998877" }),
  });
  const secondTeacherBody = await secondTeacherRes.json();
  const secondTeacherId = secondTeacherBody.teacher?.id;
  check("POST teachers: telefonlu ikinci öğretmen 201 dönüyor", secondTeacherRes.status === 201, secondTeacherRes.status);

  const duplicatePhonePatch = await fetch(`${BASE}/api/branch/teachers/${secondTeacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ phone: "05551112233" }),
  });
  check("PATCH profil: zaten kayıtlı telefonla çakışma 409 dönüyor", duplicatePhonePatch.status === 409, duplicatePhonePatch.status);

  // ===== 7) PATCH — kullanıcı adı (username) değişimi =====
  const newUsername = `test-ogretmen-${Date.now()}@seviye360.com`;
  const usernamePatchRes = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ username: newUsername }),
  });
  const usernamePatchBody = await usernamePatchRes.json();
  check("PATCH username: 200 dönüyor", usernamePatchRes.status === 200 && usernamePatchBody.teacher?.email === newUsername, usernamePatchBody.teacher);

  const dbAfterUsername = await prisma.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
  check("DB: öğretmen User.email gerçekten değişti", dbAfterUsername?.user.email === newUsername);

  const invalidUsernamePatch = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ username: "gecersiz" }),
  });
  check("PATCH username: e-posta formatı olmayan değer 400 dönüyor", invalidUsernamePatch.status === 400, invalidUsernamePatch.status);

  // ===== 8) DELETE (varsayılan) — deaktivasyon =====
  const missingDeactivate = await fetch(`${BASE}/api/branch/teachers/does-not-exist`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("DELETE teachers: olmayan id için 404 dönüyor", missingDeactivate.status === 404, missingDeactivate.status);

  const realDeactivate = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("DELETE teachers: yetkili şube yöneticisi 200 alıyor", realDeactivate.status === 200, realDeactivate.status);

  const dbUserAfterDeactivate = await prisma.user.findUnique({ where: { id: dbTeacher.userId } });
  check("DB: öğretmen SİLİNMEDİ, yalnızca isActive=false yapıldı", dbUserAfterDeactivate !== null && dbUserAfterDeactivate.isActive === false);

  const minimalListAfterDeactivate = await fetch(`${BASE}/api/branch/teachers`, { headers: { Cookie: branchAdminCookie } });
  const minimalListAfterDeactivateBody = await minimalListAfterDeactivate.json();
  check(
    "GET teachers (minimal): deaktive edilen öğretmen ARTIK listede DEĞİL",
    !minimalListAfterDeactivateBody.teachers?.some((t) => t.id === teacherId),
  );

  const fullListAfterDeactivate = await fetch(`${BASE}/api/branch/teachers?full=true`, { headers: { Cookie: branchAdminCookie } });
  const fullListAfterDeactivateBody = await fullListAfterDeactivate.json();
  const deactivatedEntry = fullListAfterDeactivateBody.teachers?.find((t) => t.id === teacherId);
  check("GET teachers?full=true: deaktive edilen öğretmen isActive=false olarak HÂLÂ listede", deactivatedEntry?.isActive === false, deactivatedEntry);

  // ===== 9) PATCH isActive=true — yeniden aktifleştirme =====
  const reactivateRes = await fetch(`${BASE}/api/branch/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ isActive: true }),
  });
  const reactivateBody = await reactivateRes.json();
  check("PATCH isActive=true: 200 ve öğretmen tekrar aktif", reactivateRes.status === 200 && reactivateBody.teacher?.isActive === true, reactivateBody.teacher);

  // ===== 10) DELETE ?permanent=true — geçmişi olan öğretmen 409 =====
  const classroom = await prisma.classroom.findFirst({ where: { tenantId: mezitli.id } });
  const timetableSlot = await prisma.timetableSlot.create({
    data: { tenantId: mezitli.id, classroomId: classroom.id, teacherId, subject: "Fizik", dayOfWeek: 5, startTime: "11:00", endTime: "11:40" },
  });
  const permanentBlockedRes = await fetch(`${BASE}/api/branch/teachers/${teacherId}?permanent=true`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("DELETE ?permanent=true: ders programı geçmişi olan öğretmen 409 ile reddediliyor", permanentBlockedRes.status === 409, permanentBlockedRes.status);
  const dbTeacherStillExists = await prisma.teacherProfile.findUnique({ where: { id: teacherId } });
  check("DB: geçmişli öğretmen kalıcı silinmedi, hâlâ mevcut", !!dbTeacherStillExists);
  await prisma.timetableSlot.delete({ where: { id: timetableSlot.id } });

  // ===== 11) DELETE ?permanent=true — geçmişi OLMAYAN öğretmen gerçekten silinir =====
  const permanentOkRes = await fetch(`${BASE}/api/branch/teachers/${secondTeacherId}?permanent=true`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("DELETE ?permanent=true: geçmişi OLMAYAN öğretmen 200 ile siliniyor", permanentOkRes.status === 200, permanentOkRes.status);
  const dbSecondTeacherGone = await prisma.teacherProfile.findUnique({ where: { id: secondTeacherId } });
  check("DB: geçmişsiz öğretmen gerçekten kalıcı silindi", dbSecondTeacherGone === null);

  // Temizlik: hâlâ duran ilk test öğretmenini de kalıcı sil (artık geçmişi yok).
  const finalCleanupRes = await fetch(`${BASE}/api/branch/teachers/${teacherId}?permanent=true`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Temizlik: ilk test öğretmeni kalıcı silindi", finalCleanupRes.status === 200, finalCleanupRes.status);

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
