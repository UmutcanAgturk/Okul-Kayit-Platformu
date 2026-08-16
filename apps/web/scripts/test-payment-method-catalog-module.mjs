// "Kayıtlı Yöntemler" (kurum geneli ödeme yöntemi kataloğu) modülünün GERÇEK
// bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı. Yeni InstitutionPaymentMethod tablosu (bkz.
// prisma/migrations/20260816190000_add_institution_payment_method) — mevcut
// `PaymentMethod` (veli kartı/tercihi) İLE KARIŞTIRILMAMALI, bu tamamen ayrı
// bir model: studentId taşımaz, tenant (şube) düzeyinde bir katalogdur.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN/ACCOUNTING erişebilir (TEACHER 403,
//      oturumsuz 401).
//   2. Oluşturma: type/label/extra doğru kaydediliyor.
//   3. Varsayılan işaretleme: bir kayıt varsayılan yapılınca diğerlerinin
//      isDefault'u otomatik false'a düşüyor.
//   4. PATCH: label/extra/isActive güncelleniyor.
//   5. DELETE: kayıt gerçekten kalkıyor.
//   6. Tenant izolasyonu: başka bir şubenin BRANCH_ADMIN'i bu kaydı ne
//      görebiliyor ne silebiliyor (404).
//   7. Aktivite Akışı'na yansıma.
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
  const mezitliAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: girişler başarılı", !!mezitliAdminCookie && !!cankayaAdminCookie && !!teacherCookie);

  const noAuthRes = await fetch(`${BASE}/api/branch/payment-method-catalog`);
  check("GET: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const teacherRes = await fetch(`${BASE}/api/branch/payment-method-catalog`, { headers: { Cookie: teacherCookie } });
  check("TEACHER görüntüleyemez: 403", teacherRes.status === 403, teacherRes.status);

  const teacherCreateRes = await fetch(`${BASE}/api/branch/payment-method-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ type: "NAKIT", label: "x" }),
  });
  check("TEACHER ekleyemez: 403", teacherCreateRes.status === 403, teacherCreateRes.status);

  // ===== Oluşturma =====
  const createRes = await fetch(`${BASE}/api/branch/payment-method-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mezitliAdminCookie },
    body: JSON.stringify({ type: "BANKA_HAVALESI", label: "Test İş Bankası Hesabı", extra: "TR000000000000000000000000" }),
  });
  const createBody = await createRes.json();
  check("POST: 201", createRes.status === 201, createRes.status);
  check("Oluşturulan type doğru", createBody.method?.type === "BANKA_HAVALESI", createBody.method?.type);
  check("Oluşturulan extra (IBAN) doğru", createBody.method?.extra === "TR000000000000000000000000", createBody.method?.extra);
  check("isDefault başlangıçta false", createBody.method?.isDefault === false, createBody.method?.isDefault);
  check("isActive başlangıçta true", createBody.method?.isActive === true, createBody.method?.isActive);
  const methodId = createBody.method.id;

  // ===== İkinci kayıt + varsayılan yapma =====
  const secondRes = await fetch(`${BASE}/api/branch/payment-method-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mezitliAdminCookie },
    body: JSON.stringify({ type: "NAKIT", label: "Test Kasa", isDefault: true }),
  });
  const secondBody = await secondRes.json();
  check("İkinci kayıt varsayılan olarak oluştu", secondBody.method?.isDefault === true, secondBody.method?.isDefault);

  const setFirstDefaultRes = await fetch(`${BASE}/api/branch/payment-method-catalog/${methodId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: mezitliAdminCookie },
    body: JSON.stringify({ isDefault: true }),
  });
  const setFirstDefaultBody = await setFirstDefaultRes.json();
  check("PATCH: ilk kayıt varsayılan yapıldı", setFirstDefaultBody.method?.isDefault === true, setFirstDefaultBody.method?.isDefault);
  const secondAfter = await prisma.institutionPaymentMethod.findUnique({ where: { id: secondBody.method.id } });
  check("İkinci kaydın isDefault'u otomatik false oldu", secondAfter?.isDefault === false, secondAfter?.isDefault);

  // ===== PATCH: label/extra/isActive güncelleme =====
  const patchRes = await fetch(`${BASE}/api/branch/payment-method-catalog/${methodId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: mezitliAdminCookie },
    body: JSON.stringify({ label: "Güncellenmiş Etiket", extra: "TR111111111111111111111111", isActive: false }),
  });
  const patchBody = await patchRes.json();
  check("PATCH: 200", patchRes.status === 200, patchRes.status);
  check("PATCH: label güncellendi", patchBody.method?.label === "Güncellenmiş Etiket", patchBody.method?.label);
  check("PATCH: extra güncellendi", patchBody.method?.extra === "TR111111111111111111111111", patchBody.method?.extra);
  check("PATCH: isActive false yapıldı", patchBody.method?.isActive === false, patchBody.method?.isActive);

  // ===== Tenant izolasyonu =====
  const crossTenantGetRes = await fetch(`${BASE}/api/branch/payment-method-catalog`, { headers: { Cookie: cankayaAdminCookie } });
  const crossTenantGetBody = await crossTenantGetRes.json();
  check(
    "Başka şube bu kaydı listesinde görmüyor",
    !crossTenantGetBody.methods?.some((m) => m.id === methodId),
    crossTenantGetBody.methods?.length,
  );

  const crossTenantPatchRes = await fetch(`${BASE}/api/branch/payment-method-catalog/${methodId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cankayaAdminCookie },
    body: JSON.stringify({ label: "x" }),
  });
  check("Başka şube düzenleyemez: 404", crossTenantPatchRes.status === 404, crossTenantPatchRes.status);

  const crossTenantDeleteRes = await fetch(`${BASE}/api/branch/payment-method-catalog/${methodId}`, {
    method: "DELETE",
    headers: { Cookie: cankayaAdminCookie },
  });
  check("Başka şube silemez: 404", crossTenantDeleteRes.status === 404, crossTenantDeleteRes.status);

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: mezitliAdminCookie } });
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => e.action);
  check("Aktivite Akışı: kataloğa eklendi", actions.includes("Ödeme yöntemi kataloğa eklendi"));
  check("Aktivite Akışı: katalog güncellendi", actions.includes("Ödeme yöntemi kataloğu güncellendi"));

  // ===== DELETE =====
  const deleteRes = await fetch(`${BASE}/api/branch/payment-method-catalog/${methodId}`, {
    method: "DELETE",
    headers: { Cookie: mezitliAdminCookie },
  });
  check("DELETE: 200", deleteRes.status === 200, deleteRes.status);
  const deletedRow = await prisma.institutionPaymentMethod.findUnique({ where: { id: methodId } });
  check("Silinen kayıt artık DB'de yok", deletedRow === null);

  // Temizlik
  await prisma.auditLogEntry.deleteMany({
    where: { action: { in: ["Ödeme yöntemi kataloğa eklendi", "Ödeme yöntemi kataloğu güncellendi", "Ödeme yöntemi kataloğundan silindi"] }, detail: { contains: "Test" } },
  });
  await prisma.institutionPaymentMethod.deleteMany({ where: { id: secondBody.method.id } });

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
