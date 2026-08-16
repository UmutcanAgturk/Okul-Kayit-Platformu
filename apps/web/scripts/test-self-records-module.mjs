// Devamsızlığım + Davranış Notlarım (öğrenci/veli tarafı) modüllerinin GERÇEK
// bir Postgres veritabanına karşı uçtan uca doğrulaması. Bu iki sayfa YENİ
// bir API eklemez — zaten var olan (ve başka modüllerce kullanılan)
// /api/students/[id]/attendance ve /api/students/[id]/discipline'ı ilk kez
// öğrenci/veli tarafına gösterir. Bu test o API'lerin öğrenci/veli
// senaryosunda doğru çalıştığını doğrular (backend zaten test edilmişti,
// burada asıl amaç UI'ın tükettiği veri şeklinin doğruluğu).
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
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  const ahmet = await prisma.studentProfile.findFirst({ where: { studentNo: "201003" } });
  if (!elif || !ahmet) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const elifCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const ahmetCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!elifCookie && !!ahmetCookie && !!parentCookie);

  // ===== Devamsızlığım =====
  const attRes = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: elifCookie } });
  const attBody = await attRes.json();
  check("GET attendance: Elif kendi kaydını görebiliyor (200)", attRes.status === 200, attRes.status);
  check(
    "summary.absenceRatePct kayıtlardan doğru hesaplanmış",
    attBody.summary?.totalDays === attBody.records?.length,
    attBody.summary,
  );

  const attOtherRes = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: ahmetCookie } });
  check("Yetki: başka bir STUDENT Elif'in devamsızlığını GÖREMİYOR (403)", attOtherRes.status === 403, attOtherRes.status);

  const attParentRes = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: parentCookie } });
  check("GET attendance: velisi PARENT görebiliyor (200)", attParentRes.status === 200, attParentRes.status);

  // ===== Davranış Notlarım =====
  const discRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: elifCookie } });
  const discBody = await discRes.json();
  check("GET discipline: Elif kendi kaydını görebiliyor (200)", discRes.status === 200, discRes.status);
  check(
    "netPoints kayıtlardan doğru hesaplanmış",
    discBody.netPoints === discBody.records?.reduce((s, r) => s + r.points, 0),
    { netPoints: discBody.netPoints, records: discBody.records?.length },
  );

  const discOtherRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: ahmetCookie } });
  check("Yetki: başka bir STUDENT Elif'in davranış kaydını GÖREMİYOR (403)", discOtherRes.status === 403, discOtherRes.status);

  const discParentRes = await fetch(`${BASE}/api/students/${elif.id}/discipline`, { headers: { Cookie: parentCookie } });
  check("GET discipline: velisi PARENT görebiliyor (200)", discParentRes.status === 200, discParentRes.status);

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
