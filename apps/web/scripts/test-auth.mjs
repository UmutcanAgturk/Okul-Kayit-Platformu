// /api/auth/login ve /api/auth/logout akışının GERÇEK bir Postgres'e karşı
// uçtan uca doğrulaması. Önkoşullar: migration + kökten `npm run seed`
// uygulanmış, `npm run dev` çalışıyor olmalı.
const BASE = "http://localhost:3000";
const SEED_DEV_PASSWORD = "seviye360dev-pw";
const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}${detail !== undefined ? " — " + detail : ""}`);
};

async function main() {
  // ===== 1) Doğru şifre =====
  const okRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "merve.aslan@seviye360.com", password: SEED_DEV_PASSWORD }),
  });
  const okBody = await okRes.json();
  check("Login: doğru şifreyle 200 dönüyor", okRes.status === 200, okRes.status);
  check("Login: yanıt kullanıcı rolünü içeriyor", okBody.user?.role === "BRANCH_ADMIN", okBody.user?.role);
  const setCookie = okRes.headers.get("set-cookie") || "";
  check("Login: httpOnly oturum çerezi set ediliyor", /seviye360_session=.+HttpOnly/i.test(setCookie), setCookie.slice(0, 60));
  const cookie = setCookie.split(";")[0];

  // ===== 2) Yanlış şifre =====
  const wrongRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "merve.aslan@seviye360.com", password: "yanlis" }),
  });
  check("Login: yanlış şifreyle 401 dönüyor", wrongRes.status === 401, wrongRes.status);

  // ===== 3) Var olmayan e-posta — aynı mesaj/kod (kullanıcı varlığı sızdırılmamalı) =====
  const wrongBody = await wrongRes.json();
  const noUserRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "olmayan-biri@seviye360.com", password: "herhangi" }),
  });
  const noUserBody = await noUserRes.json();
  check("Login: var olmayan e-posta da 401 dönüyor", noUserRes.status === 401, noUserRes.status);
  check(
    "Login: var olmayan e-posta ile yanlış şifre AYNI mesajı veriyor (kullanıcı varlığı sızmıyor)",
    noUserBody.message === wrongBody.message,
    `"${noUserBody.message}" === "${wrongBody.message}"`,
  );

  // ===== 4) Eksik alan =====
  const missingRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "merve.aslan@seviye360.com" }),
  });
  check("Login: şifre eksikse 400 dönüyor", missingRes.status === 400, missingRes.status);

  // ===== 5) Geçerli çerezle korumalı bir route'a erişim =====
  const studentRes = await fetch(`${BASE}/api/students/does-not-matter/installments`, { headers: { Cookie: cookie } });
  check("Korumalı route: geçerli çerezle 401 DÖNMÜYOR (404 dönebilir, ama oturum reddi değil)", studentRes.status !== 401, studentRes.status);

  // ===== 6) Sahte/bozuk bir çerezle erişim reddedilmeli =====
  const fakeRes = await fetch(`${BASE}/api/students/does-not-matter/installments`, { headers: { Cookie: "seviye360_session=not-a-real-jwt" } });
  check("Korumalı route: sahte çerezle 401 dönüyor", fakeRes.status === 401, fakeRes.status);

  // ===== 7) Logout sonrası çerez artık geçerli olmamalı =====
  const logoutRes = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
  check("Logout: 200 dönüyor", logoutRes.status === 200, logoutRes.status);
  const logoutSetCookie = logoutRes.headers.get("set-cookie") || "";
  check("Logout: çerezi temizliyor (Max-Age=0)", /Max-Age=0/i.test(logoutSetCookie), logoutSetCookie);

  console.log("\n=== ÖZET ===");
  const fails = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
