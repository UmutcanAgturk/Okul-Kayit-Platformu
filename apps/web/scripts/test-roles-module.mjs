// Roller modülünün (PATCH /api/branch/staff/[staffId] rol değişikliği +
// üç sekmenin kullanıcı adı düzenleme uçları) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (yalnızca BRANCH_ADMIN değiştirebilir — ACCOUNTING
// dahi 403, TEACHER 403, oturumsuz 401), geçersiz rol 400, başarılı değişim
// sonrası hem GET /api/branch/staff'ta hem DB'de yeni rolün göründüğü, ve
// Aktivite Akışı'na yansıması. Test için POST ile oluşturduğu personeli
// sonunda deaktive eder (bu depodaki "asla hard-delete etme" ilkesiyle
// tutarlı — bkz. app/api/branch/staff/[staffId] DELETE'in kendi notu).
//
// Ayrıca: GET/PATCH /api/branch/roles/students ve /api/branch/roles/guardians
// (Öğrenciler/Veliler sekmeleri) — yetki, geçersiz/duplicate kullanıcı adı,
// başarılı değişim sonrası DB doğrulaması; test sonunda orijinal e-postaya
// geri döndürülür.
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
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie);

  const createRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({
      fullName: "Test Roller Kullanıcı",
      role: "GUIDANCE_COORDINATOR",
      title: "Rehber Öğretmen",
      startDate: "2026-01-01",
      salary: 30000,
    }),
  });
  const createBody = await createRes.json();
  check("Kurulum: test personeli oluşturuldu (201)", createRes.status === 201, createBody);
  const staffId = createBody.staff.id;

  try {
    const noSession = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "BRANCH_ADMIN" }),
    });
    check("PATCH: oturumsuz 401", noSession.status === 401, noSession.status);

    const teacherRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: teacherCookie },
      body: JSON.stringify({ role: "BRANCH_ADMIN" }),
    });
    check("Yetki: TEACHER rol değiştiremez (403)", teacherRes.status === 403, teacherRes.status);

    const badRoleRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ role: "SUPERADMIN" }),
    });
    check("PATCH: geçersiz rol (SUPERADMIN) 400", badRoleRes.status === 400, badRoleRes.status);

    const changeRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ role: "ACCOUNTING" }),
    });
    const changeBody = await changeRes.json();
    check("PATCH: BRANCH_ADMIN rol değiştirebiliyor (200)", changeRes.status === 200 && changeBody.staff?.role === "ACCOUNTING", changeBody);

    const listRes = await fetch(`${BASE}/api/branch/staff`, { headers: { Cookie: branchCookie } });
    const listBody = await listRes.json();
    const row = listBody.staff.find((s) => s.id === staffId);
    check("GET staff: yeni rol listede görünüyor", row?.role === "ACCOUNTING", row);

    const dbUser = await prisma.staffProfile.findUnique({ where: { id: staffId }, include: { user: true } });
    check("DB: User.role gerçekten ACCOUNTING oldu", dbUser.user.role === "ACCOUNTING", dbUser.user.role);

    const notFoundRes = await fetch(`${BASE}/api/branch/staff/does-not-exist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ role: "BRANCH_ADMIN" }),
    });
    check("PATCH: olmayan personel için 404", notFoundRes.status === 404, notFoundRes.status);

    const lastLog = await prisma.auditLogEntry.findFirst({
      where: { action: "Personel rolü değiştirildi" },
      orderBy: { createdAt: "desc" },
    });
    check("Aktivite Akışı: rol değişikliği loglandı", !!lastLog, lastLog?.detail);

    // ===== Personel kullanıcı adı (username → User.email) düzenleme =====
    const teacherUsernameRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: teacherCookie },
      body: JSON.stringify({ username: "x@y.com" }),
    });
    check("PATCH username: TEACHER değiştiremez (403)", teacherUsernameRes.status === 403, teacherUsernameRes.status);

    const invalidUsernameRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: "gecersiz" }),
    });
    check("PATCH username: e-posta formatı olmayan değer 400", invalidUsernameRes.status === 400, invalidUsernameRes.status);

    const newUsername = `test-roller-${Date.now()}@seviye360.com`;
    const usernameRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: newUsername }),
    });
    const usernameBody = await usernameRes.json();
    check("PATCH username: BRANCH_ADMIN değiştirebiliyor (200)", usernameRes.status === 200 && usernameBody.staff?.email === newUsername, usernameBody);

    const dbAfterUsername = await prisma.staffProfile.findUnique({ where: { id: staffId }, include: { user: true } });
    check("DB: personel User.email gerçekten değişti", dbAfterUsername.user.email === newUsername, dbAfterUsername.user.email);

    const dupUsernameRes = await fetch(`${BASE}/api/branch/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: "merve.aslan@seviye360.com" }),
    });
    check("PATCH username: zaten kayıtlı e-posta 409", dupUsernameRes.status === 409, dupUsernameRes.status);
  } finally {
    await fetch(`${BASE}/api/branch/staff/${staffId}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  }

  // ===== Öğrenciler sekmesi (GET/PATCH /api/branch/roles/students) =====
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" }, include: { user: true } });
  const originalStudentEmail = elif.user.email;

  const studentsNoSession = await fetch(`${BASE}/api/branch/roles/students`);
  check("GET roles/students: oturumsuz 401", studentsNoSession.status === 401, studentsNoSession.status);

  const studentsTeacherRes = await fetch(`${BASE}/api/branch/roles/students`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER öğrenci kullanıcı adlarını göremez (403)", studentsTeacherRes.status === 403, studentsTeacherRes.status);

  const studentsRes = await fetch(`${BASE}/api/branch/roles/students`, { headers: { Cookie: branchCookie } });
  const studentsBody = await studentsRes.json();
  const elifRow = studentsBody.students?.find((s) => s.id === elif.id);
  check("GET roles/students: Elif doğru username ile listede", elifRow?.username === originalStudentEmail, elifRow);

  try {
    const studentUsernameTeacherRes = await fetch(`${BASE}/api/branch/roles/students/${elif.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: teacherCookie },
      body: JSON.stringify({ username: "x@y.com" }),
    });
    check("PATCH roles/students: TEACHER değiştiremez (403)", studentUsernameTeacherRes.status === 403, studentUsernameTeacherRes.status);

    const newStudentUsername = `test-elif-${Date.now()}@ogrenci.seviye360.com`;
    const studentUsernameRes = await fetch(`${BASE}/api/branch/roles/students/${elif.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: newStudentUsername }),
    });
    const studentUsernameBody = await studentUsernameRes.json();
    check(
      "PATCH roles/students: BRANCH_ADMIN değiştirebiliyor (200)",
      studentUsernameRes.status === 200 && studentUsernameBody.username === newStudentUsername,
      studentUsernameBody,
    );

    const dbStudentAfter = await prisma.user.findUnique({ where: { id: elif.userId } });
    check("DB: öğrenci User.email gerçekten değişti", dbStudentAfter.email === newStudentUsername, dbStudentAfter.email);

    const studentNotFoundRes = await fetch(`${BASE}/api/branch/roles/students/does-not-exist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: "x@y.com" }),
    });
    check("PATCH roles/students: olmayan öğrenci için 404", studentNotFoundRes.status === 404, studentNotFoundRes.status);
  } finally {
    await prisma.user.update({ where: { id: elif.userId }, data: { email: originalStudentEmail } });
    const restored = await prisma.user.findUnique({ where: { id: elif.userId } });
    check("Temizlik: öğrenci e-postası orijinaline döndü", restored.email === originalStudentEmail, restored.email);
  }

  // ===== Veliler sekmesi (GET/PATCH /api/branch/roles/guardians) =====
  const guardianRow = await prisma.studentGuardian.findFirst({
    where: { studentId: elif.id },
    include: { parent: { include: { user: true } } },
  });
  const originalGuardianEmail = guardianRow.parent.user.email;

  const guardiansTeacherRes = await fetch(`${BASE}/api/branch/roles/guardians`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER veli kullanıcı adlarını göremez (403)", guardiansTeacherRes.status === 403, guardiansTeacherRes.status);

  const guardiansRes = await fetch(`${BASE}/api/branch/roles/guardians`, { headers: { Cookie: branchCookie } });
  const guardiansBody = await guardiansRes.json();
  const elifGuardianRow = guardiansBody.guardians?.find((g) => g.parentId === guardianRow.parentId);
  check("GET roles/guardians: Elif'in velisi doğru username ile listede", elifGuardianRow?.username === originalGuardianEmail, elifGuardianRow);

  try {
    const newGuardianUsername = `test-veli-${Date.now()}@veli.seviye360.com`;
    const guardianUsernameRes = await fetch(`${BASE}/api/branch/roles/guardians/${guardianRow.parentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ username: newGuardianUsername }),
    });
    const guardianUsernameBody = await guardianUsernameRes.json();
    check(
      "PATCH roles/guardians: BRANCH_ADMIN değiştirebiliyor (200)",
      guardianUsernameRes.status === 200 && guardianUsernameBody.username === newGuardianUsername,
      guardianUsernameBody,
    );

    const dbGuardianAfter = await prisma.user.findUnique({ where: { id: guardianRow.parent.userId } });
    check("DB: veli User.email gerçekten değişti", dbGuardianAfter.email === newGuardianUsername, dbGuardianAfter.email);

    const cankayaGuardian = await prisma.studentGuardian.findFirst({
      where: { student: { NOT: { tenantId: elif.tenantId } } },
    });
    if (cankayaGuardian) {
      const crossTenantRes = await fetch(`${BASE}/api/branch/roles/guardians/${cankayaGuardian.parentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: branchCookie },
        body: JSON.stringify({ username: "x@y.com" }),
      });
      check("PATCH roles/guardians: başka tenant'ın velisi 404", crossTenantRes.status === 404, crossTenantRes.status);
    }
  } finally {
    await prisma.user.update({ where: { id: guardianRow.parent.userId }, data: { email: originalGuardianEmail } });
    const restoredGuardian = await prisma.user.findUnique({ where: { id: guardianRow.parent.userId } });
    check("Temizlik: veli e-postası orijinaline döndü", restoredGuardian.email === originalGuardianEmail, restoredGuardian.email);
  }

  // ===== task #100: Roller — Tüm Şubeler (bare SUPERADMIN, çapraz-tenant) =====
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: SUPERADMIN girişi başarılı", !!superadminCookie);

  const hqStaffNoAuth = await fetch(`${BASE}/api/hq/roles/staff`);
  check("GET hq/roles/staff: oturumsuz 401", hqStaffNoAuth.status === 401, hqStaffNoAuth.status);

  const hqStaffBranchAdmin = await fetch(`${BASE}/api/hq/roles/staff`, { headers: { Cookie: branchCookie } });
  check("Yetki: BRANCH_ADMIN çapraz-şube personel listesini göremiyor (403)", hqStaffBranchAdmin.status === 403, hqStaffBranchAdmin.status);

  // Not: seed verisinde kalıcı bir StaffProfile YOK (BRANCH_ADMIN hesapları
  // doğrudan User, ayrı bir StaffProfile satırı taşımaz — StaffProfile
  // yalnızca Personel ekranından oluşturulur) — bu yüzden çapraz-şube
  // görünümünü kendi kendine yeten bir fixture ile doğrularız: taze bir
  // personel oluşturup listede tenantName ile göründüğünü kontrol ederiz,
  // sonunda deaktive ederiz (bu dosyanın geri kalanıyla aynı desen).
  const hqFixtureRes = await fetch(`${BASE}/api/branch/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ fullName: "Test HQ Roller Fixture", role: "ACCOUNTING", title: "Muhasebe Görevlisi", startDate: "2026-01-01", salary: 25000 }),
  });
  const hqFixtureBody = await hqFixtureRes.json();
  const hqFixtureStaffId = hqFixtureBody.staff?.id;
  check("Kurulum: HQ testi için taze personel oluşturuldu (201)", hqFixtureRes.status === 201 && !!hqFixtureStaffId, hqFixtureRes.status);

  try {
    const hqStaffRes = await fetch(`${BASE}/api/hq/roles/staff`, { headers: { Cookie: superadminCookie } });
    const hqStaffBody = await hqStaffRes.json();
    check("GET hq/roles/staff: SUPERADMIN 200", hqStaffRes.status === 200, hqStaffRes.status);
    check(
      "GET hq/roles/staff: dolu ve her satırda tenantName var",
      (hqStaffBody.staff ?? []).length > 0 && hqStaffBody.staff.every((s) => !!s.tenantName),
      hqStaffBody.staff?.[0],
    );
    const fixtureRow = (hqStaffBody.staff ?? []).find((s) => s.id === hqFixtureStaffId);
    check(
      "GET hq/roles/staff: taze oluşturulan Mezitli personeli doğru tenantName ile listede",
      fixtureRow?.tenantName === "Özel Mezitli Seviye Anadolu Lisesi" && fixtureRow?.isActive === true,
      fixtureRow,
    );
  } finally {
    if (hqFixtureStaffId) {
      await fetch(`${BASE}/api/branch/staff/${hqFixtureStaffId}`, { method: "DELETE", headers: { Cookie: branchCookie } });
    }
  }

  const hqStudentsRes = await fetch(`${BASE}/api/hq/roles/students`, { headers: { Cookie: superadminCookie } });
  const hqStudentsBody = await hqStudentsRes.json();
  check("GET hq/roles/students: SUPERADMIN 200", hqStudentsRes.status === 200, hqStudentsRes.status);
  const studentTenantNames = new Set((hqStudentsBody.students ?? []).map((s) => s.tenantName));
  check("GET hq/roles/students: BİRDEN FAZLA şubenin öğrencisi tek listede", studentTenantNames.size >= 2, Array.from(studentTenantNames));

  const hqStudentsBranchAdmin = await fetch(`${BASE}/api/hq/roles/students`, { headers: { Cookie: branchCookie } });
  check("Yetki: BRANCH_ADMIN çapraz-şube öğrenci listesini göremiyor (403)", hqStudentsBranchAdmin.status === 403, hqStudentsBranchAdmin.status);

  const hqGuardiansRes = await fetch(`${BASE}/api/hq/roles/guardians`, { headers: { Cookie: superadminCookie } });
  const hqGuardiansBody = await hqGuardiansRes.json();
  check("GET hq/roles/guardians: SUPERADMIN 200", hqGuardiansRes.status === 200, hqGuardiansRes.status);
  check(
    "GET hq/roles/guardians: her satırda tenantName dolu",
    (hqGuardiansBody.guardians ?? []).length > 0 && hqGuardiansBody.guardians.every((g) => !!g.tenantName),
    hqGuardiansBody.guardians?.[0],
  );

  const hqGuardiansBranchAdmin = await fetch(`${BASE}/api/hq/roles/guardians`, { headers: { Cookie: branchCookie } });
  check("Yetki: BRANCH_ADMIN çapraz-şube veli listesini göremiyor (403)", hqGuardiansBranchAdmin.status === 403, hqGuardiansBranchAdmin.status);

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
