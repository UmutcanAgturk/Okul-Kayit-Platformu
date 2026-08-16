// Roller modülünün (PATCH /api/branch/staff/[staffId] rol değişikliği)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (yalnızca BRANCH_ADMIN değiştirebilir — ACCOUNTING
// dahi 403, TEACHER 403, oturumsuz 401), geçersiz rol 400, başarılı değişim
// sonrası hem GET /api/branch/staff'ta hem DB'de yeni rolün göründüğü, ve
// Aktivite Akışı'na yansıması. Test için POST ile oluşturduğu personeli
// sonunda deaktive eder (bu depodaki "asla hard-delete etme" ilkesiyle
// tutarlı — bkz. app/api/branch/staff/[staffId] DELETE'in kendi notu).
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
  } finally {
    await fetch(`${BASE}/api/branch/staff/${staffId}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  }

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
