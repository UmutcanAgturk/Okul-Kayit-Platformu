// Profilim modülünün (app/api/me/profile, app/api/me/password) GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: /api/me/profile'ın role'e göre doğru alanları döndüğü
// (öğretmen için branş, öğrenci için sınıf), oturumsuz 401, ve şifre
// değiştirmenin (mevcut şifre yanlışsa 401, yeni şifre kısa ise 400, doğruysa
// gerçekten yeni şifreyle giriş yapılabildiği) uçtan uca çalıştığı — test
// TEK KULLANIMLIK bir kullanıcı oluşturup sonunda siler, hiçbir seed
// hesabının şifresine dokunmaz.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  const mezitli = await prisma.tenant.findFirst({ where: { code: "MEZITLI-01" } });

  const noSession = await fetch(`${BASE}/api/me/profile`);
  check("GET profile: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const teacherRes = await fetch(`${BASE}/api/me/profile`, { headers: { Cookie: teacherCookie } });
  const teacherBody = await teacherRes.json();
  check("GET profile: TEACHER için branş dolu", teacherRes.status === 200 && !!teacherBody.branch, teacherBody);
  check("GET profile: kurum adı dolu", !!teacherBody.tenantName, teacherBody.tenantName);

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const studentRes = await fetch(`${BASE}/api/me/profile`, { headers: { Cookie: studentCookie } });
  const studentBody = await studentRes.json();
  check(
    "GET profile: STUDENT için öğrenci no + sınıf dolu",
    studentRes.status === 200 && studentBody.studentNo === "201001" && !!studentBody.classroomName,
    studentBody,
  );

  // ===== Şifre değiştirme — tek kullanımlık test kullanıcısı =====
  const throwawayEmail = `test-profile-${Date.now()}@seviye360.com`;
  const throwawayHash = bcrypt.hashSync(SEED_DEV_PASSWORD, 10);
  const throwawayUser = await prisma.user.create({
    data: {
      tenantId: mezitli.id,
      email: throwawayEmail,
      passwordHash: throwawayHash,
      role: "TEACHER",
      firstName: "Test",
      lastName: "Profil",
    },
  });

  try {
    const cookie = await loginAs(throwawayEmail, SEED_DEV_PASSWORD);
    check("Kurulum: tek kullanımlık kullanıcıyla giriş başarılı", !!cookie);

    const wrongCurrentRes = await fetch(`${BASE}/api/me/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: "yanlis-sifre", newPassword: "yeni-sifre-12345" }),
    });
    check("PATCH password: yanlış mevcut şifre 401", wrongCurrentRes.status === 401, wrongCurrentRes.status);

    const tooShortRes = await fetch(`${BASE}/api/me/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: SEED_DEV_PASSWORD, newPassword: "kisa" }),
    });
    check("PATCH password: kısa yeni şifre 400", tooShortRes.status === 400, tooShortRes.status);

    const changeRes = await fetch(`${BASE}/api/me/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: SEED_DEV_PASSWORD, newPassword: "yeni-sifre-12345" }),
    });
    check("PATCH password: doğru bilgilerle 200", changeRes.status === 200, changeRes.status);

    const oldPasswordLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: throwawayEmail, password: SEED_DEV_PASSWORD }),
    });
    check("Eski şifreyle artık giriş YAPILAMIYOR (401)", oldPasswordLoginRes.status === 401, oldPasswordLoginRes.status);

    const newPasswordLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: throwawayEmail, password: "yeni-sifre-12345" }),
    });
    check("Yeni şifreyle giriş yapılabiliyor (200)", newPasswordLoginRes.status === 200, newPasswordLoginRes.status);
  } finally {
    await prisma.user.delete({ where: { id: throwawayUser.id } });
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
