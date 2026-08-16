// Şube Performans Haritası modülünün (app/api/hq/branch-map) GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (BRANCH_ADMIN 403, oturumsuz 401), Mezitli/Çankaya
// şubelerinin doğru şehir/ilçe ile döndüğü, öğrenci sayısının ham
// StudentProfile sayımıyla eştiği, ve capacity null olduğunda (seed'de
// hiçbir tenant'a capacity atanmamış) doluluk oranının dürüstçe 0 döndüğü
// (uydurulmadığı — demo'daki branchOccupancy ile aynı kural).
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
  const mezitli = await prisma.tenant.findFirst({ where: { code: "MEZITLI-01" } });
  if (!mezitli) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");
  const rawStudentCount = await prisma.studentProfile.count({ where: { tenantId: mezitli.id } });

  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!superadminCookie && !!branchCookie);

  const noSession = await fetch(`${BASE}/api/hq/branch-map`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const branchRes = await fetch(`${BASE}/api/hq/branch-map`, { headers: { Cookie: branchCookie } });
  check("Yetki: BRANCH_ADMIN göremez (403)", branchRes.status === 403, branchRes.status);

  const res = await fetch(`${BASE}/api/hq/branch-map`, { headers: { Cookie: superadminCookie } });
  const body = await res.json();
  check("GET: SUPERADMIN görüntüleyebiliyor (200)", res.status === 200, res.status);
  check("2 şube dönüyor (Mezitli + Çankaya)", body.branches?.length === 2, body.branches?.length);

  const mezitliRow = body.branches?.find((b) => b.id === mezitli.id);
  check("Mezitli şehir/ilçe doğru", mezitliRow?.city === "Mersin" && mezitliRow?.district === "Mezitli", mezitliRow);
  check("Mezitli öğrenci sayısı ham veriyle eşleşiyor", mezitliRow?.studentCount === rawStudentCount, { got: mezitliRow?.studentCount, expected: rawStudentCount });
  check(
    "capacity null olduğundan doluluk dürüstçe %0 (uydurulmadı)",
    mezitliRow?.capacity === null && mezitliRow?.occupancyPct === 0,
    mezitliRow,
  );
  check("Ciro sayısal ve negatif değil", typeof mezitliRow?.revenue === "number" && mezitliRow.revenue >= 0, mezitliRow?.revenue);
  check(
    "Tahsilat oranı 0-100 arası",
    typeof mezitliRow?.collectionPct === "number" && mezitliRow.collectionPct >= 0 && mezitliRow.collectionPct <= 100,
    mezitliRow?.collectionPct,
  );

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
