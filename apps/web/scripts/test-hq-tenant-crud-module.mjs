// Genel Merkez "Yeni Kurum Ekle" / devre dışı bırakma akışının GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı. Yeni Tenant alanları ekler (address/phone/email/
// capacity/taxNo) — bkz. prisma/migrations/20260729054948_add_tenant_contact_fields.
// Yeni bir tablo eklemez.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca SUPERADMIN yeni kurum ekleyebilir/durumunu
//      değiştirebilir (BRANCH_ADMIN 403, oturumsuz 401).
//   2. POST /api/hq/tenants: yeni kurum + otomatik BRANCH_ADMIN hesabı
//      oluşturuyor, dönen kimlik bilgileriyle GERÇEKTEN giriş yapılabiliyor.
//      kurumTuru/openingDate/managerPhone alanları da doğru kaydediliyor.
//   3. Yeni kurumun GET /api/hq/tenants listesinde doğru alanlarla (capacity,
//      address vb.) göründüğü.
//   4. Devre dışı bırakma/yeniden etkinleştirme (toggle-active) doğru çalışıyor
//      ve Genel Merkez'in devre dışı bırakılamadığı.
//   5. Aktivite Akışı'na yansıma.
//   6. PATCH /api/hq/tenants/[tenantId]: kurum bilgileri + şube müdürünün
//      (BRANCH_ADMIN User) ad/soyad/telefonu güncelleniyor (bkz. task #52).
//   7. POST /api/hq/tenants/[tenantId]/reset-credentials: yeni bir geçici
//      şifre üretiyor, döndürdüğü şifreyle GERÇEKTEN giriş yapılabiliyor.
//   8. DELETE /api/hq/tenants/[tenantId]: öğrenci/personel/sınıfı OLAN bir
//      kurum 409 ile reddediliyor (Mezitli); tamamen boş bir kurum ise
//      kalıcı olarak siliniyor (BRANCH_ADMIN hesabı ve audit log'larıyla
//      birlikte).
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
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("SUPERADMIN login başarılı", !!superadminCookie);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN login başarılı", !!branchAdminCookie);

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/hq/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "x", city: "x", district: "x", managerFirstName: "x", managerLastName: "x" }),
  });
  check("POST /api/hq/tenants: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const branchCreateRes = await fetch(`${BASE}/api/hq/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "x", city: "x", district: "x", managerFirstName: "x", managerLastName: "x" }),
  });
  check("BRANCH_ADMIN kurum ekleyemez: 403", branchCreateRes.status === 403, branchCreateRes.status);

  // ===== Yeni kurum ekleme =====
  const createRes = await fetch(`${BASE}/api/hq/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({
      name: "Özel Konak Seviye Test Kurs Merkezi",
      city: "İzmir",
      district: "Konak",
      address: "Test Mahallesi No:1",
      phone: "05001234567",
      capacity: 250,
      taxNo: "1234567890",
      managerFirstName: "Test",
      managerLastName: "Müdürü",
      kurumTuru: "Kurs Merkezi",
      openingDate: "2020-09-01",
      managerPhone: "05119876543",
    }),
  });
  const createBody = await createRes.json();
  check("POST /api/hq/tenants: 201 dönüyor", createRes.status === 201, createRes.status);
  check("Yeni kurum type SUBE", createBody.tenant?.type === "SUBE", createBody.tenant?.type);
  check("Yeni kurum capacity doğru", createBody.tenant?.capacity === 250, createBody.tenant?.capacity);
  check("Yeni kurum kurumTuru doğru", createBody.tenant?.kurumTuru === "Kurs Merkezi", createBody.tenant?.kurumTuru);
  check("credentials.username dolu", !!createBody.credentials?.username, createBody.credentials?.username);
  check("credentials.password dolu", !!createBody.credentials?.password);
  const newTenantId = createBody.tenant.id;

  // ===== Yeni müdür hesabıyla GERÇEK giriş =====
  const newManagerCookie = await loginAs(createBody.credentials.username, createBody.credentials.password);
  check("Yeni şube müdürü hesabıyla giriş yapılabiliyor", !!newManagerCookie);
  const meRes = await fetch(`${BASE}/api/me`, { headers: { Cookie: newManagerCookie } });
  const meBody = await meRes.json();
  check("Yeni müdür rolü BRANCH_ADMIN", meBody.role === "BRANCH_ADMIN", meBody.role);
  check("Yeni müdür doğru tenant'a bağlı", meBody.tenantId === newTenantId, meBody.tenantId);

  // ===== Listede görünüyor mu =====
  const listRes = await fetch(`${BASE}/api/hq/tenants`, { headers: { Cookie: superadminCookie } });
  const listBody = await listRes.json();
  const listedTenant = listBody.tenants?.find((t) => t.id === newTenantId);
  check("Yeni kurum listede görünüyor", !!listedTenant);
  check("Listede address doğru", listedTenant?.address === "Test Mahallesi No:1", listedTenant?.address);
  check("Listede isActive true", listedTenant?.isActive === true, listedTenant?.isActive);
  check("Listede branchAdminName doğru", listedTenant?.branchAdminName === "Test Müdürü", listedTenant?.branchAdminName);
  check("Listede branchAdminPhone doğru", listedTenant?.branchAdminPhone === "05119876543", listedTenant?.branchAdminPhone);
  check("Listede kurumTuru doğru", listedTenant?.kurumTuru === "Kurs Merkezi", listedTenant?.kurumTuru);
  check("Listede openingDate dolu", !!listedTenant?.openingDate, listedTenant?.openingDate);

  // ===== PATCH: kurum düzenleme (task #52) =====
  const branchPatchRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "x" }),
  });
  check("BRANCH_ADMIN kurum düzenleyemez: 403", branchPatchRes.status === 403, branchPatchRes.status);

  const patchRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({
      name: "Özel Konak Seviye Test Kurs Merkezi (Güncel)",
      kurumTuru: "Fen Lisesi",
      managerFirstName: "Test",
      managerLastName: "Müdürü İkinci",
      managerPhone: "05229998877",
    }),
  });
  const patchBody = await patchRes.json();
  check("PATCH /api/hq/tenants/[tenantId]: 200 dönüyor", patchRes.status === 200, patchRes.status);
  check("PATCH: kurum adı güncellendi", patchBody.tenant?.name === "Özel Konak Seviye Test Kurs Merkezi (Güncel)", patchBody.tenant?.name);
  check("PATCH: kurumTuru güncellendi", patchBody.tenant?.kurumTuru === "Fen Lisesi", patchBody.tenant?.kurumTuru);
  check("PATCH: branchAdminName güncellendi", patchBody.branchAdminName === "Test Müdürü İkinci", patchBody.branchAdminName);
  check("PATCH: branchAdminPhone güncellendi", patchBody.branchAdminPhone === "05229998877", patchBody.branchAdminPhone);

  // ===== Kimlik bilgisi sıfırlama (task #52) =====
  const branchResetRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}/reset-credentials`, {
    method: "POST",
    headers: { Cookie: branchAdminCookie },
  });
  check("BRANCH_ADMIN kimlik bilgisi sıfırlayamaz: 403", branchResetRes.status === 403, branchResetRes.status);

  const resetRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}/reset-credentials`, {
    method: "POST",
    headers: { Cookie: superadminCookie },
  });
  const resetBody = await resetRes.json();
  check("POST reset-credentials: 200 dönüyor", resetRes.status === 200, resetRes.status);
  check("reset-credentials: yeni şifre eskisinden farklı", resetBody.credentials?.password !== createBody.credentials.password);
  const afterResetCookie = await loginAs(resetBody.credentials.username, resetBody.credentials.password);
  check("Yeni sıfırlanan şifreyle giriş yapılabiliyor", !!afterResetCookie);
  const oldPasswordCookie = await loginAs(createBody.credentials.username, createBody.credentials.password);
  check("Eski şifre artık geçersiz", !oldPasswordCookie);

  // ===== Yetki kontrolleri (toggle-active) =====
  const branchToggleRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}/toggle-active`, { method: "POST", headers: { Cookie: branchAdminCookie } });
  check("BRANCH_ADMIN kurum durumunu değiştiremez: 403", branchToggleRes.status === 403, branchToggleRes.status);

  // ===== Devre dışı bırakma =====
  const deactivateRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}/toggle-active`, { method: "POST", headers: { Cookie: superadminCookie } });
  const deactivateBody = await deactivateRes.json();
  check("Devre dışı bırakma: isActive false", deactivateBody.isActive === false, deactivateBody.isActive);

  const listAfterDeactivateRes = await fetch(`${BASE}/api/hq/tenants`, { headers: { Cookie: superadminCookie } });
  const listAfterDeactivateBody = await listAfterDeactivateRes.json();
  check(
    "Listede devre dışı olarak görünüyor",
    listAfterDeactivateBody.tenants?.find((t) => t.id === newTenantId)?.isActive === false,
  );

  // ===== Yeniden etkinleştirme =====
  const reactivateRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}/toggle-active`, { method: "POST", headers: { Cookie: superadminCookie } });
  const reactivateBody = await reactivateRes.json();
  check("Yeniden etkinleştirme: isActive true", reactivateBody.isActive === true, reactivateBody.isActive);

  // ===== Genel Merkez devre dışı bırakılamaz =====
  const genelMerkez = await prisma.tenant.findFirst({ where: { code: "GENEL-MERKEZ" } });
  const gmToggleRes = await fetch(`${BASE}/api/hq/tenants/${genelMerkez.id}/toggle-active`, { method: "POST", headers: { Cookie: superadminCookie } });
  check("Genel Merkez devre dışı bırakılamaz: 400", gmToggleRes.status === 400, gmToggleRes.status);
  const gmDeleteRes = await fetch(`${BASE}/api/hq/tenants/${genelMerkez.id}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Genel Merkez silinemez: 400", gmDeleteRes.status === 400, gmDeleteRes.status);

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: newManagerCookie } });
  // yeni müdür de BRANCH_ADMIN olduğu için kendi tenant'ının aktivite akışını görebilir
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => e.action);
  check("Aktivite Akışı: yeni kurum eklendi", actions.includes("Yeni kurum eklendi"));
  check("Aktivite Akışı: kurum devre dışı bırakıldı", actions.includes("Kurum devre dışı bırakıldı"));
  check("Aktivite Akışı: kurum yeniden etkinleştirildi", actions.includes("Kurum yeniden etkinleştirildi"));
  check("Aktivite Akışı: kurum bilgileri güncellendi", actions.includes("Kurum bilgileri güncellendi"));
  check("Aktivite Akışı: şube müdürü şifresi sıfırlandı", actions.includes("Şube müdürü şifresi sıfırlandı"));

  // ===== DELETE: dolu bir kurum (Mezitli) 409 ile reddedilmeli =====
  const mezitli = await prisma.tenant.findFirst({ where: { code: { startsWith: "MEZITLI" } } });
  const branchDeleteRes = await fetch(`${BASE}/api/hq/tenants/${mezitli.id}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("BRANCH_ADMIN kurum silemez: 403", branchDeleteRes.status === 403, branchDeleteRes.status);

  const busyDeleteRes = await fetch(`${BASE}/api/hq/tenants/${mezitli.id}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Dolu kurum (öğrencisi olan) silinemez: 409", busyDeleteRes.status === 409, busyDeleteRes.status);
  const mezitliStillThere = await prisma.tenant.findUnique({ where: { id: mezitli.id } });
  check("Dolu kurum DB'de hâlâ duruyor", !!mezitliStillThere);

  // ===== DELETE: boş test kurumu (öğrenci/personel/sınıfı yok) kalıcı silinmeli =====
  const emptyDeleteRes = await fetch(`${BASE}/api/hq/tenants/${newTenantId}`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Boş kurum kalıcı olarak silinir: 200", emptyDeleteRes.status === 200, emptyDeleteRes.status);
  const deletedTenant = await prisma.tenant.findUnique({ where: { id: newTenantId } });
  check("Silinen kurum artık DB'de yok", deletedTenant === null);
  const orphanUsers = await prisma.user.findMany({ where: { tenantId: newTenantId } });
  check("Silinen kurumun BRANCH_ADMIN hesabı da kaldırıldı", orphanUsers.length === 0, orphanUsers.length);
  const orphanLogs = await prisma.auditLogEntry.findMany({ where: { tenantId: newTenantId } });
  check("Silinen kurumun audit log'ları da kaldırıldı", orphanLogs.length === 0, orphanLogs.length);

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
