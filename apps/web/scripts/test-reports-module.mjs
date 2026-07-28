// Raporlar/Dışa Aktarım Merkezi'nin GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı. Yeni bir Prisma
// modeli/migration EKLEMEZ — Öğrenci, Personel/Öğretmen, Devamsızlık, Sınav
// ve Muhasebe modüllerinin gerçek verisinden anında rapor üretir (bkz.
// app/api/branch/reports/* route'larındaki notlar).
//
// Kontrol ettikleri:
//   1. Yetki: 5 endpoint de yalnızca BRANCH_ADMIN'e açık (TEACHER 403,
//      oturumsuz 401).
//   2. 4 CSV endpoint'i doğru Content-Type + Content-Disposition döner ve
//      beklenen başlık satırını içerir.
//   3. financial-summary JSON şekli doğru (rows/totalIncome/totalExpense/
//      netProfit/recordCount) ve netProfit === totalIncome - totalExpense.
//   4. Her GET, Aktivite Akışı'na "Rapor indirildi"/"Rapor görüntülendi"
//      kaydı düşüyor (temizlik dahil).
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

const CSV_REPORTS = [
  { path: "/api/branch/reports/students", filename: "ogrenci_listesi.csv", header: "Öğrenci No,Ad Soyad,Sınıf,Veli,Veli Telefon,Ödeme Durumu", detail: "Öğrenci Listesi (CSV)" },
  { path: "/api/branch/reports/staff", filename: "personel_listesi.csv", header: "Ad Soyad,Rol,Branş/Departman,Telefon,Durum", detail: "Personel Listesi (CSV)" },
  { path: "/api/branch/reports/attendance-summary", filename: "devamsizlik_ozeti.csv", header: "Sınıf,Sınıf Düzeyi,Öğrenci Sayısı,Alınan Gün Sayısı,Devamsızlık Oranı", detail: "Devamsızlık Özeti (CSV)" },
  { path: "/api/branch/reports/exam-summary", filename: "sinav_sonuclari_ozeti.csv", header: "Öğrenci No,Ad Soyad,Sınıf,Sınav Sayısı,Genel Ortalama Net", detail: "Sınav Sonuçları Özeti (CSV)" },
];

async function main() {
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN login başarılı", !!branchAdminCookie);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("TEACHER login başarılı", !!teacherCookie);

  // ===== Yetki kontrolleri =====
  for (const r of CSV_REPORTS) {
    const noAuthRes = await fetch(`${BASE}${r.path}`);
    check(`GET ${r.path}: oturumsuz 401`, noAuthRes.status === 401, noAuthRes.status);

    const teacherRes = await fetch(`${BASE}${r.path}`, { headers: { Cookie: teacherCookie } });
    check(`GET ${r.path}: TEACHER 403`, teacherRes.status === 403, teacherRes.status);
  }
  const noAuthFinRes = await fetch(`${BASE}/api/branch/reports/financial-summary`);
  check("GET financial-summary: oturumsuz 401", noAuthFinRes.status === 401, noAuthFinRes.status);
  const teacherFinRes = await fetch(`${BASE}/api/branch/reports/financial-summary`, { headers: { Cookie: teacherCookie } });
  check("GET financial-summary: TEACHER 403", teacherFinRes.status === 403, teacherFinRes.status);

  // ===== CSV raporları =====
  for (const r of CSV_REPORTS) {
    const res = await fetch(`${BASE}${r.path}`, { headers: { Cookie: branchAdminCookie } });
    check(`GET ${r.path}: BRANCH_ADMIN 200`, res.status === 200, res.status);
    check(`GET ${r.path}: Content-Type text/csv`, (res.headers.get("content-type") || "").includes("text/csv"));
    check(`GET ${r.path}: Content-Disposition dosya adı doğru`, (res.headers.get("content-disposition") || "").includes(r.filename));
    const body = await res.text();
    check(`GET ${r.path}: başlık satırı doğru`, body.split("\n")[0] === r.header, body.split("\n")[0]);
  }

  // ===== Mali özet (JSON) =====
  const finRes = await fetch(`${BASE}/api/branch/reports/financial-summary`, { headers: { Cookie: branchAdminCookie } });
  check("GET financial-summary: BRANCH_ADMIN 200", finRes.status === 200, finRes.status);
  const finBody = await finRes.json();
  check("financial-summary: rows dizisi var", Array.isArray(finBody.rows));
  check(
    "financial-summary: netProfit === totalIncome - totalExpense",
    Math.abs(finBody.netProfit - (finBody.totalIncome - finBody.totalExpense)) < 0.001,
    finBody.netProfit,
  );
  check("financial-summary: recordCount sayısal", typeof finBody.recordCount === "number", finBody.recordCount);

  // ===== Aktivite Akışı'na yansıma =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => `${e.action}|${e.detail}`);
  check(
    "Aktivite Akışı: Öğrenci Listesi indirmesi kaydedildi",
    actions.includes("Rapor indirildi|Öğrenci Listesi (CSV)"),
  );
  check(
    "Aktivite Akışı: Mali Özet görüntülemesi kaydedildi",
    actions.includes("Rapor görüntülendi|Mali Özet"),
  );

  // Temizlik
  await prisma.auditLogEntry.deleteMany({ where: { action: { in: ["Rapor indirildi", "Rapor görüntülendi"] } } });

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
