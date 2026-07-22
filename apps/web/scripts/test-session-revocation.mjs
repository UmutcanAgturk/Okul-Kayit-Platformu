// Oturum iptali (session revocation) akışının GERÇEK bir Postgres'e karşı
// uçtan uca doğrulaması. JWT'nin kendisi 7 gün geçerli olsa bile, altında
// yatan `UserSession` satırı iptal edilirse (logout veya logout-all) veya
// süresi dolarsa erişim hemen kesilmeli. Önkoşullar: migration + kökten
// `npm run seed` uygulanmış, `npm run dev` çalışıyor olmalı.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public" } },
});
const BASE = "http://localhost:3000";
const SEED_DEV_PASSWORD = "seviye360dev-pw";
const EMAIL = "merve.aslan@seviye360.com";
const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}${detail !== undefined ? " — " + detail : ""}`);
};

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SEED_DEV_PASSWORD }),
  });
  if (res.status !== 200) return null;
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

async function canAccess(cookie) {
  const res = await fetch(`${BASE}/api/students/does-not-matter/installments`, { headers: { Cookie: cookie } });
  return res.status !== 401;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  // ===== 1) İki ayrı "cihazdan" (bağımsız login) giriş — ikisi de aynı anda geçerli =====
  const cookieA = await login();
  const cookieB = await login();
  check("Login: cihaz A girişi başarılı", !!cookieA);
  check("Login: cihaz B girişi başarılı", !!cookieB);
  check("Cihaz A: giriş sonrası erişim var", await canAccess(cookieA));
  check("Cihaz B: giriş sonrası erişim var", await canAccess(cookieB));

  const sessionCountAfterLogin = await prisma.userSession.count({ where: { userId: user.id, revokedAt: null } });
  check("DB: kullanıcının en az 2 iptal edilmemiş oturumu var", sessionCountAfterLogin >= 2, sessionCountAfterLogin);

  // ===== 2) Cihaz A'da logout — yalnızca A'nın oturumu iptal edilmeli =====
  const logoutRes = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: cookieA } });
  check("Logout: 200 dönüyor", logoutRes.status === 200, logoutRes.status);
  check("Cihaz A: logout sonrası erişim YOK", !(await canAccess(cookieA)));
  check("Cihaz B: A'nın logout'undan ETKİLENMEDİ, erişim hâlâ var", await canAccess(cookieB));

  // ===== 3) Sahte/bozulmuş bir çerezle tekrar logout çağırmak hata vermemeli =====
  const doubleLogoutRes = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: cookieA } });
  check("Logout (tekrar, zaten iptal edilmiş oturumla): yine 200 dönüyor", doubleLogoutRes.status === 200, doubleLogoutRes.status);

  // ===== 4) logout-all: oturum olmadan çağrılamaz =====
  const logoutAllNoSession = await fetch(`${BASE}/api/auth/logout-all`, { method: "POST" });
  check("Logout-all: oturum yoksa 401 dönüyor", logoutAllNoSession.status === 401, logoutAllNoSession.status);

  // ===== 5) logout-all: cihaz B üzerinden çağrıldığında AYNI kullanıcının TÜM oturumları iptal olur =====
  const cookieC = await login();
  check("Login: cihaz C girişi başarılı (logout-all testi için)", !!cookieC);
  const logoutAllRes = await fetch(`${BASE}/api/auth/logout-all`, { method: "POST", headers: { Cookie: cookieB } });
  check("Logout-all: 200 dönüyor", logoutAllRes.status === 200, logoutAllRes.status);
  check("Cihaz B: logout-all sonrası erişim YOK (kendi isteğini de iptal eder)", !(await canAccess(cookieB)));
  check("Cihaz C: logout-all sonrası erişim YOK (başka cihaz da iptal edildi)", !(await canAccess(cookieC)));

  const sessionCountAfterLogoutAll = await prisma.userSession.count({ where: { userId: user.id, revokedAt: null } });
  check("DB: logout-all sonrası kullanıcının iptal edilmemiş hiç oturumu kalmadı", sessionCountAfterLogoutAll === 0, sessionCountAfterLogoutAll);

  // ===== 6) Süresi dolmuş bir oturum, iptal edilmemiş olsa bile reddedilmeli =====
  const cookieD = await login();
  check("Login: cihaz D girişi başarılı (süre dolması testi için)", !!cookieD);
  check("Cihaz D: giriş sonrası erişim var", await canAccess(cookieD));
  const sidD = await prisma.userSession.findFirst({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  await prisma.userSession.update({ where: { id: sidD.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("Cihaz D: süresi geçmişe alınınca erişim YOK (iptal edilmemiş olsa bile)", !(await canAccess(cookieD)));

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
