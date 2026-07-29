// Akademik Yol Haritası modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış
// (Elif Yılmaz/Ahmet Yılmaz için AI Sınıf Röntgeni sınav sonuçları seed'de
// oluşturulur), `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
// Yeni bir Prisma modeli EKLEMEZ — Karne (report-card) ile birebir aynı
// prensip: ExamResult/StudentAchievementResult'ın (Ölçme-Değerlendirme) ve
// StudentProfile.targetGoal'ın (şemada zaten vardı) tek bir görünümde
// birleşimi.
//
// Kontrol ettikleri: yetki (Karne ile birebir aynı desen — STUDENT yalnızca
// kendi kaydını, PARENT yalnızca velisi olduğu öğrencinin kaydını,
// TEACHER/BRANCH_ADMIN her öğrenciyi görebiliyor, tenant izolasyonu), net/
// maxPossibleNet/netPct hesabının doğru olduğu, kritik kazanımların
// (ortalama correctRatio < 0.4) doğru filtrelendiği ve kritik kazanımı
// olmayan bir öğrenci için boş liste döndüğü.
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
  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const ahmet = await prisma.studentProfile.findFirst({ where: { user: { email: "ahmet.yilmaz@ogrenci.seviye360.com" } } });
  if (!elif || !ahmet) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const elifCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const ahmetCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!elifCookie && !!ahmetCookie && !!parentCookie && !!teacherCookie && !!cankayaCookie,
  );

  const noSession = await fetch(`${BASE}/api/students/${elif.id}/roadmap`);
  check("GET roadmap: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  // ===== Elif: kritik kazanımı yok (en düşük ratio 0.4, eşik <0.4) =====
  const elifRes = await fetch(`${BASE}/api/students/${elif.id}/roadmap`, { headers: { Cookie: elifCookie } });
  const elifBody = await elifRes.json();
  check("GET roadmap: STUDENT kendi yol haritasını görebiliyor (200)", elifRes.status === 200, elifRes.status);
  check("Elif: gradeLevel doğru", elifBody.gradeLevel === "SINIF_9", elifBody.gradeLevel);
  check("Elif: examCount > 0", elifBody.examCount > 0, elifBody.examCount);
  check("Elif: latestNet/maxPossibleNet sayısal", typeof elifBody.latestNet === "number" && typeof elifBody.maxPossibleNet === "number");
  check(
    "Elif: netPct = round(latestNet/maxPossibleNet*100)",
    elifBody.netPct === Math.round((elifBody.latestNet / elifBody.maxPossibleNet) * 100),
    JSON.stringify({ latestNet: elifBody.latestNet, maxPossibleNet: elifBody.maxPossibleNet, netPct: elifBody.netPct }),
  );
  check("Elif: kritik kazanım YOK (en düşük ratio tam 0.4, eşik altında değil)", elifBody.criticalAchievements?.length === 0, elifBody.criticalAchievements);

  // ===== Ahmet: FIZ.9.3.1.4 ratio 0.2 → kritik listede olmalı =====
  const ahmetRes = await fetch(`${BASE}/api/students/${ahmet.id}/roadmap`, { headers: { Cookie: ahmetCookie } });
  const ahmetBody = await ahmetRes.json();
  check("GET roadmap: Ahmet kendi yol haritasını görebiliyor (200)", ahmetRes.status === 200, ahmetRes.status);
  check(
    "Ahmet: FIZ.9.3.1.4 kritik kazanımlar listesinde",
    ahmetBody.criticalAchievements?.some((a) => a.code === "FIZ.9.3.1.4" && Math.abs(a.avgRatio - 0.2) < 1e-9),
    JSON.stringify(ahmetBody.criticalAchievements),
  );

  // ===== Yetki: başka öğrenci / veli / öğretmen / tenant =====
  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/roadmap`, { headers: { Cookie: ahmetCookie } });
  check("Yetki: başka bir STUDENT Elif'in yol haritasını GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/roadmap`, { headers: { Cookie: parentCookie } });
  check("GET roadmap: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const parentForbiddenRes = await fetch(`${BASE}/api/students/${ahmet.id}/roadmap`, { headers: { Cookie: parentCookie } });
  check("Yetki: velisi olmadığı Ahmet'in yol haritasını GÖREMİYOR (403)", parentForbiddenRes.status === 403, parentForbiddenRes.status);

  const teacherRes = await fetch(`${BASE}/api/students/${elif.id}/roadmap`, { headers: { Cookie: teacherCookie } });
  check("GET roadmap: TEACHER (personel) görebiliyor (200)", teacherRes.status === 200, teacherRes.status);

  const cankayaRes = await fetch(`${BASE}/api/students/${elif.id}/roadmap`, { headers: { Cookie: cankayaCookie } });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)", cankayaRes.status === 404, cankayaRes.status);

  const missingRes = await fetch(`${BASE}/api/students/does-not-exist/roadmap`, { headers: { Cookie: teacherCookie } });
  check("GET roadmap: olmayan öğrenci için 404 dönüyor", missingRes.status === 404, missingRes.status);

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
