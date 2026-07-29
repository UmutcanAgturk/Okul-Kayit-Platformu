// Global Analytics modülünün GERÇEK bir Postgres veritabanına karşı uçtan
// uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run
// dev` sunucusu (localhost:3000) çalışıyor olmalı. Yeni bir Prisma modeli
// EKLEMEZ — saf agregasyon (bkz. app/api/hq/analytics).
//
// Kontrol ettikleri: yetki (yalnızca SUPERADMIN), orgAvgNet/topBranches/
// subjectPerformance/branchRevenue'nun HER BİRİNİN ham DB verisinden bu
// scriptin kendi hesapladığı beklenen değerlerle eşleştiği (demo'daki
// uydurma `ciro` alanının yerini gerçek AccountingLedgerEntry GELİR toplamı
// aldığı dahil).
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

function subjectFromCode(code) {
  const prefix = code.split(".")[0];
  const map = { MAT: "Matematik", FIZ: "Fizik", KIM: "Kimya", BIY: "Biyoloji", TUR: "Türkçe", TAR: "Tarih", ING: "İngilizce" };
  return map[prefix] ?? prefix;
}

async function main() {
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: SUPERADMIN/BRANCH_ADMIN için giriş başarılı", !!superadminCookie && !!branchAdminCookie);

  const noAuthRes = await fetch(`${BASE}/api/hq/analytics`);
  check("GET hq/analytics: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const branchRes = await fetch(`${BASE}/api/hq/analytics`, { headers: { Cookie: branchAdminCookie } });
  check("BRANCH_ADMIN görüntüleyemez: 403", branchRes.status === 403, branchRes.status);

  const res = await fetch(`${BASE}/api/hq/analytics`, { headers: { Cookie: superadminCookie } });
  const body = await res.json();
  check("SUPERADMIN görüntüler: 200", res.status === 200, res.status);

  // ===== Ham DB'den beklenen değerleri hesapla =====
  const branches = await prisma.tenant.findMany({ where: { type: "SUBE" } });
  const totalStudents = await prisma.studentProfile.count({ where: { tenant: { type: "SUBE" } } });
  check("totalBranches ham tenant sayısıyla eşleşiyor", body.totalBranches === branches.length, body.totalBranches);
  check("totalStudents ham StudentProfile sayısıyla eşleşiyor", body.totalStudents === totalStudents, body.totalStudents);

  const examResults = await prisma.examResult.findMany({ where: { tenant: { type: "SUBE" } }, select: { tenantId: true, netScore: true } });
  const expectedOrgAvgNet = examResults.length ? examResults.reduce((a, r) => a + r.netScore, 0) / examResults.length : null;
  check(
    "orgAvgNet ham ExamResult ortalamasıyla eşleşiyor",
    expectedOrgAvgNet !== null && Math.abs(body.orgAvgNet - expectedOrgAvgNet) < 1e-9,
    JSON.stringify({ got: body.orgAvgNet, expected: expectedOrgAvgNet }),
  );

  const netsByTenant = new Map();
  for (const r of examResults) {
    if (!netsByTenant.has(r.tenantId)) netsByTenant.set(r.tenantId, []);
    netsByTenant.get(r.tenantId).push(r.netScore);
  }
  const expectedTop = Array.from(netsByTenant.entries())
    .map(([tenantId, nets]) => ({ tenantId, avgNet: nets.reduce((a, b) => a + b, 0) / nets.length }))
    .sort((a, b) => b.avgNet - a.avgNet)
    .slice(0, 3);
  check(
    "topBranches sırası ve ortalamaları ham veriyle eşleşiyor",
    body.topBranches.length === expectedTop.length &&
      body.topBranches.every((b, i) => b.tenantId === expectedTop[i].tenantId && Math.abs(b.avgNet - expectedTop[i].avgNet) < 1e-9),
    JSON.stringify({ got: body.topBranches, expected: expectedTop }),
  );

  const achievementRows = await prisma.studentAchievementResult.findMany({
    where: { student: { tenant: { type: "SUBE" } } },
    include: { achievement: true },
  });
  const bySubject = new Map();
  for (const a of achievementRows) {
    const subject = subjectFromCode(a.achievement.code);
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(a.correctRatio);
  }
  const expectedSubjects = Array.from(bySubject.entries())
    .map(([subject, ratios]) => ({ subject, avgMasteryPct: Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100), count: ratios.length }))
    .sort((a, b) => b.avgMasteryPct - a.avgMasteryPct);
  check(
    "subjectPerformance ham StudentAchievementResult ortalamasıyla eşleşiyor",
    JSON.stringify(body.subjectPerformance) === JSON.stringify(expectedSubjects),
    JSON.stringify({ got: body.subjectPerformance, expected: expectedSubjects }),
  );

  const ledgerRows = await prisma.accountingLedgerEntry.findMany({ where: { tenant: { type: "SUBE" } }, select: { tenantId: true, type: true, amount: true } });
  const gelirByTenant = new Map();
  for (const e of ledgerRows) {
    if (e.type !== "GELIR") continue;
    gelirByTenant.set(e.tenantId, (gelirByTenant.get(e.tenantId) ?? 0) + Number(e.amount));
  }
  const expectedRevenue = branches
    .map((b) => ({ tenantId: b.id, totalGelir: gelirByTenant.get(b.id) ?? 0 }))
    .sort((a, b) => b.totalGelir - a.totalGelir);
  check(
    "branchRevenue (GELİR toplamı) sırası ve tutarları ham veriyle eşleşiyor",
    body.branchRevenue.length === expectedRevenue.length &&
      body.branchRevenue.every((b, i) => b.tenantId === expectedRevenue[i].tenantId && b.totalGelir === expectedRevenue[i].totalGelir),
    JSON.stringify({ got: body.branchRevenue.map((b) => ({ id: b.tenantId, gelir: b.totalGelir })), expected: expectedRevenue }),
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
