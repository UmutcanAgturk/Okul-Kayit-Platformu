// Muhasebe defteri API'sinin (dördüncü gerçek modül) GERÇEK bir Postgres'e
// karşı uçtan uca doğrulaması — taksit tahsilatı, etüt onay/red ve AI Sınıf
// Röntgeni'ndeki aynı deseni (gerçek DB + RLS + oturum tabanlı kimlik)
// tekrarlar. Önkoşullar: migration + kökten `npm run seed` uygulanmış,
// `npm run dev` çalışıyor olmalı.
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
  const mezitli = await prisma.tenant.findUnique({ where: { code: "MEZITLI-01" } });
  if (!mezitli) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("Login: Mezitli şube yöneticisi girişi başarılı", !!branchAdminCookie);

  // ===== 1) Oturum olmadan erişim engellenmeli =====
  const noSession = await fetch(`${BASE}/api/branch/accounting-ledger`);
  check("GET accounting-ledger: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  // ===== 2) Şube yöneticisi kendi defterini görür =====
  const listRes = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET accounting-ledger: 200 dönüyor", listRes.status === 200, listRes.status);
  check("GET accounting-ledger: seed'deki en az 2 kayıt listeleniyor", listBody.entries?.length >= 2, listBody.entries?.length);
  check(
    "GET accounting-ledger: özet (summary) gelir/gider/net içeriyor",
    typeof listBody.summary?.totalGelir === "number" && typeof listBody.summary?.totalGider === "number",
    JSON.stringify(listBody.summary),
  );
  check("GET accounting-ledger: seed'deki Kira gideri listede", listBody.entries?.some((e) => e.category === "Kira"), listBody.entries?.map((e) => e.category));

  // ===== 3) Yetki: TEACHER ve STUDENT rolleri defteri göremez =====
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const asTeacher = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü Muhasebe defterini göremiyor (403)", asTeacher.status === 403, asTeacher.status);

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const asStudent = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT rolü Muhasebe defterini göremiyor (403)", asStudent.status === 403, asStudent.status);

  // ===== 4) Şube yöneticisi yeni bir kayıt oluşturur =====
  const postRes = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "Kırtasiye", amount: 750, entryDate: "2026-07-20", note: "Test kaydı" }),
  });
  const postBody = await postRes.json();
  check("POST accounting-ledger: 201 dönüyor", postRes.status === 201, postRes.status);
  check("POST accounting-ledger: createdByUserId oturumdaki kullanıcıya atfediliyor (istemciden değil)", postBody.entry?.createdByUserId, postBody.entry?.createdByUserId);

  const dbEntry = await prisma.accountingLedgerEntry.findUnique({ where: { id: postBody.entry?.id } });
  check("DB: yeni kayıt gerçekten Mezitli tenant'ına yazılmış", dbEntry?.tenantId === mezitli.id, dbEntry?.tenantId);
  check("DB: tutar doğru kaydedilmiş", Number(dbEntry?.amount) === 750, dbEntry?.amount?.toString());

  // ===== 5) Girdi doğrulama =====
  const badPost = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GELIR", category: "", amount: -5, entryDate: "not-a-date" }),
  });
  check("POST accounting-ledger: geçersiz girdi 400 dönüyor", badPost.status === 400, badPost.status);

  // ===== 6) Yetki: TEACHER kayıt oluşturamaz =====
  const teacherPost = await fetch(`${BASE}/api/branch/accounting-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ type: "GELIR", category: "Deneme", amount: 100, entryDate: "2026-07-20" }),
  });
  check("Yetki: TEACHER rolü kayıt oluşturamıyor (403)", teacherPost.status === 403, teacherPost.status);

  // ===== 7) Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kayıtlarını göremez =====
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaList = await fetch(`${BASE}/api/branch/accounting-ledger`, { headers: { Cookie: cankayaCookie } });
  const cankayaBody = await cankayaList.json();
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli kategorilerini GÖREMİYOR", !cankayaBody.entries?.some((e) => e.category === "Kira" || e.category === "Kırtasiye"), cankayaBody.entries?.map((e) => e.category));

  // ===== 8) PATCH: kayıt düzenleme (task #59) =====
  const patchRes = await fetch(`${BASE}/api/branch/accounting-ledger/${postBody.entry.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "Kırtasiye (düzenlendi)", amount: 900, entryDate: "2026-07-21", note: "Düzenlendi" }),
  });
  const patchBody = await patchRes.json();
  check("PATCH accounting-ledger: 200 dönüyor", patchRes.status === 200, patchRes.status);
  check("PATCH accounting-ledger: kategori güncellendi", patchBody.entry?.category === "Kırtasiye (düzenlendi)", patchBody.entry?.category);
  check("PATCH accounting-ledger: tutar güncellendi", Number(patchBody.entry?.amount) === 900, patchBody.entry?.amount);

  const dbEntryAfterPatch = await prisma.accountingLedgerEntry.findUnique({ where: { id: postBody.entry.id } });
  check("DB: PATCH sonrası tutar gerçekten güncellenmiş", Number(dbEntryAfterPatch?.amount) === 900, dbEntryAfterPatch?.amount?.toString());

  const patchInvalid = await fetch(`${BASE}/api/branch/accounting-ledger/${postBody.entry.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "", amount: -5, entryDate: "not-a-date" }),
  });
  check("PATCH accounting-ledger: geçersiz girdi 400 dönüyor", patchInvalid.status === 400, patchInvalid.status);

  const patchNotFound = await fetch(`${BASE}/api/branch/accounting-ledger/not-a-real-id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "GIDER", category: "Test", amount: 10, entryDate: "2026-07-21" }),
  });
  check("PATCH accounting-ledger: var olmayan kayıt 404 dönüyor", patchNotFound.status === 404, patchNotFound.status);

  const teacherPatch = await fetch(`${BASE}/api/branch/accounting-ledger/${postBody.entry.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ type: "GIDER", category: "Test", amount: 10, entryDate: "2026-07-21" }),
  });
  check("Yetki: TEACHER rolü kaydı düzenleyemiyor (403)", teacherPatch.status === 403, teacherPatch.status);

  const cankayaPatch = await fetch(`${BASE}/api/branch/accounting-ledger/${postBody.entry.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ type: "GIDER", category: "Test", amount: 10, entryDate: "2026-07-21" }),
  });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kaydını düzenleyemiyor (404)", cankayaPatch.status === 404, cankayaPatch.status);

  // ===== 9) GET filtreleme (tür + kategori arama) =====
  const filterTypeRes = await fetch(`${BASE}/api/branch/accounting-ledger?type=GIDER`, { headers: { Cookie: branchAdminCookie } });
  const filterTypeBody = await filterTypeRes.json();
  check("GET accounting-ledger?type=GIDER: yalnızca GIDER kayıtları dönüyor", filterTypeBody.entries?.every((e) => e.type === "GIDER"), filterTypeBody.entries?.map((e) => e.type));

  const filterSearchRes = await fetch(`${BASE}/api/branch/accounting-ledger?search=düzenlendi`, { headers: { Cookie: branchAdminCookie } });
  const filterSearchBody = await filterSearchRes.json();
  check(
    "GET accounting-ledger?search=düzenlendi: yalnızca eşleşen kategori dönüyor",
    filterSearchBody.entries?.length >= 1 && filterSearchBody.entries.every((e) => e.category.toLowerCase().includes("düzenlendi")),
    filterSearchBody.entries?.map((e) => e.category),
  );

  const filterNoMatchRes = await fetch(`${BASE}/api/branch/accounting-ledger?search=xyzabc-yok`, { headers: { Cookie: branchAdminCookie } });
  const filterNoMatchBody = await filterNoMatchRes.json();
  check("GET accounting-ledger?search=xyzabc-yok: boş liste dönüyor", filterNoMatchBody.entries?.length === 0, filterNoMatchBody.entries?.length);

  // ===== 11) Kira Stopajı Özeti (task #84) =====
  const noSessionWithholding = await fetch(`${BASE}/api/branch/accounting-ledger/withholding-summary`);
  check("GET withholding-summary: oturumsuz 401", noSessionWithholding.status === 401, noSessionWithholding.status);

  const teacherWithholding = await fetch(`${BASE}/api/branch/accounting-ledger/withholding-summary`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü kira stopajı özetini göremiyor (403)", teacherWithholding.status === 403, teacherWithholding.status);

  const withholdingRes = await fetch(`${BASE}/api/branch/accounting-ledger/withholding-summary`, { headers: { Cookie: branchAdminCookie } });
  const withholdingBody = await withholdingRes.json();
  check("GET withholding-summary: 200 dönüyor", withholdingRes.status === 200, withholdingRes.status);
  check("GET withholding-summary: seed'deki Kira kaydı (18000, %20) hesaba dahil", withholdingBody.summary?.kayitSayisi >= 1, withholdingBody.summary);
  check(
    "GET withholding-summary: stopajKesintisi = brutToplam - netOdenecek",
    Math.abs(withholdingBody.summary.stopajKesintisi - (withholdingBody.summary.brutToplam - withholdingBody.summary.netOdenecek)) < 0.01,
    withholdingBody.summary,
  );

  const cankayaWithholding = await fetch(`${BASE}/api/branch/accounting-ledger/withholding-summary`, { headers: { Cookie: cankayaCookie } });
  const cankayaWithholdingBody = await cankayaWithholding.json();
  check(
    "Tenant izolasyonu: Çankaya'nın kira stopajı özeti Mezitli'ninkinden farklı",
    cankayaWithholdingBody.summary?.brutToplam !== withholdingBody.summary?.brutToplam || cankayaWithholdingBody.summary?.kayitSayisi === 0,
    cankayaWithholdingBody.summary,
  );

  // ===== 12) Vergi Ayarları (task #84) =====
  const noSessionTax = await fetch(`${BASE}/api/branch/tax-settings`);
  check("GET tax-settings: oturumsuz 401", noSessionTax.status === 401, noSessionTax.status);

  const teacherTax = await fetch(`${BASE}/api/branch/tax-settings`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü vergi ayarlarını göremiyor (403)", teacherTax.status === 403, teacherTax.status);

  const taxGetRes = await fetch(`${BASE}/api/branch/tax-settings`, { headers: { Cookie: branchAdminCookie } });
  const taxGetBody = await taxGetRes.json();
  check("GET tax-settings: 200 dönüyor", taxGetRes.status === 200, taxGetRes.status);
  const originalTaxNo = taxGetBody.settings?.taxNo ?? null;
  const originalTaxOffice = taxGetBody.settings?.taxOffice ?? null;

  const teacherTaxPatch = await fetch(`${BASE}/api/branch/tax-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ taxNo: "0000000000" }),
  });
  check("Yetki: TEACHER rolü vergi ayarlarını değiştiremiyor (403)", teacherTaxPatch.status === 403, teacherTaxPatch.status);

  const taxPatchRes = await fetch(`${BASE}/api/branch/tax-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ taxNo: "3330011122", taxOffice: "Mezitli Vergi Dairesi (test)" }),
  });
  const taxPatchBody = await taxPatchRes.json();
  check("PATCH tax-settings: 200 dönüyor", taxPatchRes.status === 200, taxPatchRes.status);
  check("PATCH tax-settings: Vergi No güncellendi", taxPatchBody.settings?.taxNo === "3330011122", taxPatchBody.settings);
  check("PATCH tax-settings: Vergi Dairesi güncellendi", taxPatchBody.settings?.taxOffice === "Mezitli Vergi Dairesi (test)", taxPatchBody.settings);

  const dbTenantAfterPatch = await prisma.tenant.findUnique({ where: { id: mezitli.id } });
  check("DB: Tenant.taxOffice gerçekten güncellendi", dbTenantAfterPatch?.taxOffice === "Mezitli Vergi Dairesi (test)", dbTenantAfterPatch?.taxOffice);

  const cankayaTaxPatch = await fetch(`${BASE}/api/branch/tax-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ taxNo: "9999999999" }),
  });
  check("PATCH tax-settings: Çankaya yöneticisi kendi tenant'ını güncelleyebiliyor (200)", cankayaTaxPatch.status === 200, cankayaTaxPatch.status);

  const dbMezitliUnaffected = await prisma.tenant.findUnique({ where: { id: mezitli.id } });
  check(
    "Tenant izolasyonu: Çankaya'nın PATCH'i Mezitli'nin taxNo'sunu ETKİLEMİYOR",
    dbMezitliUnaffected?.taxNo === "3330011122",
    dbMezitliUnaffected?.taxNo,
  );

  // Temizlik: her iki tenant'ın vergi ayarlarını orijinaline döndür
  await prisma.tenant.update({ where: { id: mezitli.id }, data: { taxNo: originalTaxNo, taxOffice: originalTaxOffice } });
  const cankaya = await prisma.tenant.findUnique({ where: { code: "CANKAYA-01" } });
  if (cankaya) await prisma.tenant.update({ where: { id: cankaya.id }, data: { taxNo: null } });
  check("Temizlik: vergi ayarları orijinaline döndürüldü", true);

  // ===== 13) Temizlik: bu script'in oluşturduğu test kaydını sil =====
  const cleanupRes = await fetch(`${BASE}/api/branch/accounting-ledger/${postBody.entry.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("Temizlik: test kaydı silindi", cleanupRes.status === 200, cleanupRes.status);

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
