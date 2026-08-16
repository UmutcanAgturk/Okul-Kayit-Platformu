// Personel (StaffProfile) modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (StaffProfile
// migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET/POST /api/branch/staff — yetki, doğrulama, oluşturma, tenant izolasyonu.
//   2. Yeni personelin döndürülen kullanıcı adı/şifresiyle GERÇEKTEN giriş yapabildiği.
//   3. DELETE /api/branch/staff/:id — deaktivasyon (silme değil), yetki, 404'ler.
//   4. POST /api/branch/payroll — hem teacherId hem staffProfileId ile (birbirini
//      dışlayan iki yol), personName/personRole doğruluğu, duplicate 409.
//   5. Veritabanı seviyesindeki PayrollRecord_teacher_or_staff_check CHECK
//      constraint'inin (ikisi birden dolu bir satırı) gerçekten reddettiği.
//   6. PATCH status (ACTIVE/ON_LEAVE/RESIGNED) — İzinli hâlâ giriş
//      yapabiliyor (isActive=true), Ayrıldı girişi engelliyor (isActive=false).
//   7. POST staff: opsiyonel email (özel kullanıcı adı) alanı + duplicate 409.
//   8. DELETE ?permanent=true — bordro geçmişi OLAN personel 409 ile
//      reddediliyor (asla kalıcı silinmiyor), OLMAYAN personel gerçekten
//      kalıcı siliniyor.
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

  // ===== 1) GET /api/branch/staff =====
  const noSessionList = await fetch(`${BASE}/api/branch/staff`);
  check("GET staff: oturum yoksa 401 dönüyor", noSessionList.status === 401, noSessionList.status);

  const teacherList = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü personel listesini göremiyor (403)", teacherList.status === 403, teacherList.status);

  const listBefore = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: branchAdminCookie } });
  const listBeforeBody = await listBefore.json();
  check("GET staff: 200 dönüyor", listBefore.status === 200, listBefore.status);
  const countBefore = listBeforeBody.staff?.length ?? 0;

  // ===== 2) POST /api/branch/staff — doğrulama =====
  const noSessionCreate = await fetch(`${BASE}/api/branch/staff`, { method: "POST", body: JSON.stringify({}) });
  check("POST staff: oturum yoksa 401 dönüyor", noSessionCreate.status === 401, noSessionCreate.status);

  const teacherCreate = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ fullName: "Test Personel", role: "ACCOUNTING", title: "Test", startDate: "2026-01-01", salary: 30000 }),
  });
  check("Yetki: TEACHER rolü personel oluşturamıyor (403)", teacherCreate.status === 403, teacherCreate.status);

  const invalidCreate = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "", role: "ACCOUNTING", title: "", startDate: "2026-01-01", salary: -5 }),
  });
  check("POST staff: eksik/geçersiz alanlar 400 dönüyor", invalidCreate.status === 400, invalidCreate.status);

  // ===== 3) POST /api/branch/staff — başarılı oluşturma + gerçek giriş =====
  const createRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      fullName: "Deniz Yılmaz",
      role: "ACCOUNTING",
      title: "Muhasebe Görevlisi",
      department: "İdari İşler",
      startDate: "2026-01-15",
      salary: 45000,
    }),
  });
  const createBody = await createRes.json();
  const staffId = createBody.staff?.id;
  check("POST staff: 201 dönüyor ve personel oluşturuluyor", createRes.status === 201 && !!staffId, createRes.status);
  check("POST staff: giriş bilgileri (username/password) döndü", !!createBody.credentials?.username && !!createBody.credentials?.password);

  const dbStaff = await prisma.staffProfile.findUnique({ where: { id: staffId }, include: { user: true } });
  check("DB: StaffProfile doğru tenant'ta ve rolde oluşturuldu", dbStaff?.tenantId === mezitli.id && dbStaff?.user.role === "ACCOUNTING");

  const newStaffCookie = await loginAs(createBody.credentials.username, createBody.credentials.password);
  check("Yeni personel döndürülen kullanıcı adı/şifresiyle GERÇEKTEN giriş yapabiliyor", !!newStaffCookie);

  const listAfterCreate = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: branchAdminCookie } });
  const listAfterCreateBody = await listAfterCreate.json();
  check("GET staff: yeni personel listede görünüyor", listAfterCreateBody.staff?.length === countBefore + 1);

  // ===== 4) Tenant izolasyonu =====
  const cankayaList = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaList.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin personelini GÖREMİYOR",
    !cankayaListBody.staff?.some((s) => s.name === "Deniz Yılmaz"),
  );

  const cankayaDeactivateAttempt = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "DELETE",
    headers: { Cookie: cankayaCookie },
  });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin personelini devre dışı bırakamıyor (404)",
    cankayaDeactivateAttempt.status === 404,
    cankayaDeactivateAttempt.status,
  );
  const stillActive = await prisma.user.findUnique({ where: { id: dbStaff.userId } });
  check("DB: yetkisiz denemeden sonra personel hâlâ aktif", stillActive?.isActive === true);

  // ===== 4b) PATCH /api/branch/staff/:id — profil düzenleme (unvan/departman/maaş/telefon) =====
  const teacherProfilePatch = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ title: "Yeni Unvan" }),
  });
  check("Yetki: TEACHER personel profilini düzenleyemiyor (403)", teacherProfilePatch.status === 403, teacherProfilePatch.status);

  const profilePatchRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "Ön Büro Sorumlusu", department: "İdari İşler", salary: 47000, phone: "05551112233" }),
  });
  const profilePatchBody = await profilePatchRes.json();
  check("PATCH profil: 200 dönüyor", profilePatchRes.status === 200, profilePatchRes.status);
  check("PATCH profil: unvan güncellendi", profilePatchBody.staff?.title === "Ön Büro Sorumlusu", profilePatchBody.staff?.title);
  check("PATCH profil: telefon güncellendi", profilePatchBody.staff?.phone === "05551112233", profilePatchBody.staff?.phone);
  check("PATCH profil: maaş güncellendi", Number(profilePatchBody.staff?.salary) === 47000, profilePatchBody.staff?.salary);

  const listAfterProfilePatch = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: branchAdminCookie } });
  const listAfterProfilePatchBody = await listAfterProfilePatch.json();
  const patchedEntry = listAfterProfilePatchBody.staff?.find((s) => s.id === staffId);
  check("GET staff: güncellenmiş telefon listede görünüyor", patchedEntry?.phone === "05551112233", patchedEntry?.phone);

  const secondStaffRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "Test İkinci Personel", role: "ACCOUNTING", title: "Muhasebe Görevlisi", startDate: "2026-01-15", salary: 40000, phone: "05559998877" }),
  });
  const secondStaffBody = await secondStaffRes.json();
  const secondStaffId = secondStaffBody.staff?.id;
  check("POST staff: telefonlu ikinci personel 201 dönüyor", secondStaffRes.status === 201, secondStaffRes.status);

  const duplicatePhonePatch = await fetch(`${BASE}/api/branch/staff/${secondStaffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ phone: "05551112233" }),
  });
  check("PATCH profil: zaten kayıtlı telefonla çakışma 409 dönüyor", duplicatePhonePatch.status === 409, duplicatePhonePatch.status);

  // ===== 5) POST /api/branch/payroll — staffProfileId ile =====
  const period = "2026-07";
  const bothIdsRes = await fetch(`${BASE}/api/branch/payroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ teacherId: "x", staffProfileId: staffId, period, grossSalary: 45000 }),
  });
  check("POST payroll: hem teacherId hem staffProfileId birlikte 400 dönüyor", bothIdsRes.status === 400, bothIdsRes.status);

  const neitherIdRes = await fetch(`${BASE}/api/branch/payroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ period, grossSalary: 45000 }),
  });
  check("POST payroll: ne teacherId ne staffProfileId 400 dönüyor", neitherIdRes.status === 400, neitherIdRes.status);

  const payrollRes = await fetch(`${BASE}/api/branch/payroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ staffProfileId: staffId, period, grossSalary: 45000 }),
  });
  const payrollBody = await payrollRes.json();
  check("POST payroll: staffProfileId ile 201 dönüyor", payrollRes.status === 201, payrollRes.status);

  const payrollDuplicateRes = await fetch(`${BASE}/api/branch/payroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ staffProfileId: staffId, period, grossSalary: 45000 }),
  });
  check("POST payroll: aynı personel+dönem için ikinci kez 409 dönüyor", payrollDuplicateRes.status === 409, payrollDuplicateRes.status);

  const payrollListRes = await fetch(`${BASE}/api/branch/payroll`, { headers: { Cookie: branchAdminCookie } });
  const payrollListBody = await payrollListRes.json();
  const createdRecord = payrollListBody.records?.find((r) => r.staffProfileId === staffId);
  check(
    "GET payroll: yeni kayıt personRole=STAFF ve doğru personName ile listede",
    createdRecord?.personRole === "STAFF" && createdRecord?.personName === "Deniz Yılmaz",
    JSON.stringify(createdRecord),
  );

  const dbPayrollRecord = await prisma.payrollRecord.findUnique({ where: { id: createdRecord.id } });
  check("DB: PayrollRecord.staffProfileId doğru, teacherId null", dbPayrollRecord?.staffProfileId === staffId && dbPayrollRecord?.teacherId === null);

  // ===== 6) DB seviyesi — CHECK constraint gerçekten çalışıyor mu =====
  let checkConstraintRejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PayrollRecord" (id, "tenantId", "teacherId", "staffProfileId", period, "grossSalary", "sgkEmployeeShare", "unemploymentEmployeeShare", "incomeTaxWithheld", "stampDutyWithheld", "netSalary", "sgkEmployerShare", "unemploymentEmployerShare", "employerCost", "createdByUserId", "createdAt")
       SELECT 'test-check-violation', $1, tp.id, $2, '2026-08', 1, 1, 1, 1, 1, 1, 1, 1, 1, u.id, now()
       FROM "TeacherProfile" tp, "User" u WHERE u."tenantId" = $1 LIMIT 1`,
      mezitli.id,
      staffId,
    );
  } catch (e) {
    checkConstraintRejected = /PayrollRecord_teacher_or_staff_check|constraint/i.test(String(e));
  }
  check("DB: CHECK constraint hem teacherId hem staffProfileId dolu bir satırı reddediyor", checkConstraintRejected);
  await prisma.payrollRecord.deleteMany({ where: { id: "test-check-violation" } });

  // ===== 7) DELETE /api/branch/staff/:id — deaktivasyon =====
  const teacherDeactivate = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Yetki: TEACHER rolü personeli devre dışı bırakamıyor (403)", teacherDeactivate.status === 403, teacherDeactivate.status);

  const missingDeactivate = await fetch(`${BASE}/api/branch/staff/does-not-exist`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE staff: olmayan id için 404 dönüyor", missingDeactivate.status === 404, missingDeactivate.status);

  const realDeactivate = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE staff: yetkili şube yöneticisi 200 alıyor", realDeactivate.status === 200, realDeactivate.status);

  const dbUserAfter = await prisma.user.findUnique({ where: { id: dbStaff.userId } });
  check("DB: personel SİLİNMEDİ, yalnızca isActive=false yapıldı", dbUserAfter !== null && dbUserAfter.isActive === false);

  const stillListedInactive = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: branchAdminCookie } });
  const stillListedInactiveBody = await stillListedInactive.json();
  const inactiveEntry = stillListedInactiveBody.staff?.find((s) => s.id === staffId);
  check("GET staff: deaktive edilen personel listede isActive=false olarak görünüyor", inactiveEntry?.isActive === false);

  // ===== 8) PATCH /api/branch/staff/:id — yeniden aktifleştirme =====
  const reactivateRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ isActive: true }),
  });
  const reactivateBody = await reactivateRes.json();
  check("PATCH isActive=true: 200 dönüyor (yeniden aktifleştirme)", reactivateRes.status === 200, reactivateRes.status);
  check("Personel tekrar aktif", reactivateBody.staff?.isActive === true, reactivateBody.staff?.isActive);

  const dbUserAfterReactivate = await prisma.user.findUnique({ where: { id: dbStaff.userId } });
  check("DB: personel gerçekten yeniden aktif", dbUserAfterReactivate?.isActive === true);

  // ===== 9) PATCH status — üç durumlu (Aktif/İzinli/Ayrıldı) =====
  const onLeaveRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ status: "ON_LEAVE" }),
  });
  const onLeaveBody = await onLeaveRes.json();
  check(
    "PATCH status=ON_LEAVE: 200 ve İzinli personel HÂLÂ isActive=true (girişi engellenmiyor)",
    onLeaveRes.status === 200 && onLeaveBody.staff?.status === "ON_LEAVE" && onLeaveBody.staff?.isActive === true,
    onLeaveBody.staff,
  );

  const resignedRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ status: "RESIGNED" }),
  });
  const resignedBody = await resignedRes.json();
  check(
    "PATCH status=RESIGNED: 200 ve isActive=false (giriş engellendi)",
    resignedRes.status === 200 && resignedBody.staff?.status === "RESIGNED" && resignedBody.staff?.isActive === false,
    resignedBody.staff,
  );

  const badStatusRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ status: "GECERSIZ" }),
  });
  check("PATCH status: geçersiz değer 400 dönüyor", badStatusRes.status === 400, badStatusRes.status);

  // status'ü ACTIVE'e geri döndür (aşağıdaki testler ve temizlik için)
  await fetch(`${BASE}/api/branch/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ status: "ACTIVE" }),
  });

  // ===== 10) POST /api/branch/staff — özel e-posta (kullanıcı adı) alanı =====
  const customEmail = `test-personel-email-${Date.now()}@seviye360.com`;
  const emailStaffRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "Test Özel Eposta", role: "ACCOUNTING", title: "Muhasebe Görevlisi", startDate: "2026-01-01", salary: 35000, email: customEmail }),
  });
  const emailStaffBody = await emailStaffRes.json();
  check("POST staff: özel e-posta ile 201 ve doğru e-posta döndü", emailStaffRes.status === 201 && emailStaffBody.staff?.email === customEmail, emailStaffBody.staff);
  const emailStaffId = emailStaffBody.staff?.id;

  const dupEmailRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ fullName: "Çakışan Eposta", role: "ACCOUNTING", title: "x", startDate: "2026-01-01", salary: 1000, email: customEmail }),
  });
  check("POST staff: zaten kayıtlı e-posta 409 dönüyor", dupEmailRes.status === 409, dupEmailRes.status);

  // ===== 11) DELETE ?permanent=true — kalıcı silme =====
  const permanentBlockedRes = await fetch(`${BASE}/api/branch/staff/${staffId}?permanent=true`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE ?permanent=true: bordro geçmişi olan personel 409 ile reddediliyor", permanentBlockedRes.status === 409, permanentBlockedRes.status);
  const dbStaffStillExists = await prisma.staffProfile.findUnique({ where: { id: staffId } });
  check("DB: bordrolu personel kalıcı silinmedi, hâlâ mevcut", !!dbStaffStillExists, dbStaffStillExists?.id);

  const permanentOkRes = await fetch(`${BASE}/api/branch/staff/${emailStaffId}?permanent=true`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE ?permanent=true: bordro geçmişi OLMAYAN personel 200 ile siliniyor", permanentOkRes.status === 200, permanentOkRes.status);
  const dbEmailStaffGone = await prisma.staffProfile.findUnique({ where: { id: emailStaffId } });
  check("DB: bordrosuz personel gerçekten kalıcı silindi", dbEmailStaffGone === null);

  // Temizlik
  const staffIdsToClean = [staffId, secondStaffId].filter(Boolean);
  const profilesToClean = await prisma.staffProfile.findMany({ where: { id: { in: staffIdsToClean } } });
  const userIdsToClean = profilesToClean.map((p) => p.userId);
  await prisma.payrollRecord.deleteMany({ where: { staffProfileId: { in: staffIdsToClean } } });
  await prisma.staffProfile.deleteMany({ where: { id: { in: staffIdsToClean } } });
  await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });

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
