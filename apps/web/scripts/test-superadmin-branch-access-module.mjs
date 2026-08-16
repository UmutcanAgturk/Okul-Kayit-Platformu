// SUPERADMIN'in "Bu Şube Olarak Yönet" (app/api/hq/acting-tenant) ile
// /api/branch/... route'larına eriştiği yeni mekanizmanın GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: (1) actingTenantId olmadan SUPERADMIN /api/branch/...
// route'larına 403 alır, (2) geçersiz/pasif/GENEL_MERKEZ tenantId reddedilir,
// (3) bir şube seçildikten sonra SUPERADMIN o şubenin verisini GERÇEK bir
// BRANCH_ADMIN ile AYNI şekilde görür, (4) SUPERADMIN o şubede oluşturduğu
// bir kayıt GERÇEK tenantId ile DB'ye yazılır (null DEĞİL) ve o şubenin kendi
// BRANCH_ADMIN'i tarafından görülebilir, (5) başka bir şubeye geçince önceki
// şubenin verisi ASLA görünmez (RLS izolasyonu), (6) "Şubeden Çık" sonrası
// tekrar 403 alınır, (7) normal BRANCH_ADMIN/TEACHER akışı ETKİLENMEMİŞ.
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

function mergeCookies(...cookieStrings) {
  return cookieStrings.filter(Boolean).join("; ");
}

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
  const cankaya = await prisma.tenant.findFirst({ where: { code: "CANKAYA-01" } });
  const genelMerkez = await prisma.tenant.findFirst({ where: { type: "GENEL_MERKEZ" } });
  if (!mezitli || !cankaya) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  const mezitliAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!superadminCookie && !!mezitliAdminCookie && !!cankayaAdminCookie);

  // ===== 1) actingTenantId olmadan SUPERADMIN branch route'larına 403 alır =====
  const noActingRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: superadminCookie } });
  check("actingTenantId yokken SUPERADMIN /api/branch/crm-leads 403 alır", noActingRes.status === 403, noActingRes.status);

  // ===== 2) Geçersiz/pasif/GENEL_MERKEZ tenantId reddedilir =====
  const badTenantRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: "does-not-exist" }),
  });
  check("Geçersiz tenantId reddediliyor (400)", badTenantRes.status === 400, badTenantRes.status);

  const genelMerkezActRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: genelMerkez.id }),
  });
  check("GENEL_MERKEZ tenantId'si 'şube olarak' seçilemiyor (400)", genelMerkezActRes.status === 400, genelMerkezActRes.status);

  const nonSuperadminActRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mezitliAdminCookie },
    body: JSON.stringify({ tenantId: cankaya.id }),
  });
  check("BRANCH_ADMIN 'şube olarak yönet' kullanamaz (403)", nonSuperadminActRes.status === 403, nonSuperadminActRes.status);

  // ===== 3) Mezitli'yi seç, gerçek Mezitli BRANCH_ADMIN'iyle aynı veriyi gör =====
  const actAsMezitliRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: mezitli.id }),
  });
  const actAsMezitliBody = await actAsMezitliRes.json();
  check("Mezitli 'şube olarak' seçilebiliyor (200)", actAsMezitliRes.status === 200 && actAsMezitliBody.tenantId === mezitli.id, actAsMezitliBody);
  const actingCookie = (actAsMezitliRes.headers.get("set-cookie") || "").split(";")[0];
  const superadminActingAsMezitli = mergeCookies(superadminCookie, actingCookie);

  const meRes = await fetch(`${BASE}/api/me`, { headers: { Cookie: superadminActingAsMezitli } });
  const meBody = await meRes.json();
  check("/api/me actingTenantName'i doğru dönüyor", meBody.actingTenantName === mezitli.name, meBody.actingTenantName);

  const [superadminLeadsRes, mezitliAdminLeadsRes] = await Promise.all([
    fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: superadminActingAsMezitli } }),
    fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: mezitliAdminCookie } }),
  ]);
  const superadminLeadsBody = await superadminLeadsRes.json();
  const mezitliAdminLeadsBody = await mezitliAdminLeadsRes.json();
  check("Mezitli olarak yöneten SUPERADMIN 200 alır", superadminLeadsRes.status === 200, superadminLeadsRes.status);
  check(
    "SUPERADMIN(Mezitli), gerçek Mezitli admin'iyle AYNI lead sayısını görür",
    superadminLeadsBody.leads?.length === mezitliAdminLeadsBody.leads?.length,
    { superadmin: superadminLeadsBody.leads?.length, mezitliAdmin: mezitliAdminLeadsBody.leads?.length },
  );

  // ===== 4) SUPERADMIN(Mezitli) yeni bir CRM lead oluşturur — gerçek tenantId'yle yazılmalı =====
  const uniqueName = `Test SA Lead ${Date.now()}`;
  const createLeadRes = await fetch(`${BASE}/api/branch/crm-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminActingAsMezitli },
    body: JSON.stringify({ candidateFullName: uniqueName, candidateGradeLevel: "SINIF_9", guardianFullName: "Test Veli", guardianPhone: "05551112233" }),
  });
  const createLeadBody = await createLeadRes.json();
  check("SUPERADMIN(Mezitli) yeni CRM lead oluşturabiliyor (201)", createLeadRes.status === 201, createLeadRes.status);

  const dbLead = await prisma.crmLead.findFirst({ where: { candidateFullName: uniqueName } });
  check("DB: oluşturulan lead'in tenantId'si GERÇEK Mezitli (null DEĞİL)", dbLead?.tenantId === mezitli.id, dbLead?.tenantId);

  const dbLog = await prisma.auditLogEntry.findFirst({ where: { detail: { contains: uniqueName } }, orderBy: { createdAt: "desc" } });
  check("DB: Aktivite Akışı kaydının tenantId'si GERÇEK Mezitli (null DEĞİL)", dbLog?.tenantId === mezitli.id, dbLog?.tenantId);

  const mezitliAdminSeesLeadRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: mezitliAdminCookie } });
  const mezitliAdminSeesLeadBody = await mezitliAdminSeesLeadRes.json();
  check(
    "Gerçek Mezitli admin'i, SUPERADMIN'in oluşturduğu lead'i görüyor",
    mezitliAdminSeesLeadBody.leads?.some((l) => l.candidateFullName === uniqueName),
    mezitliAdminSeesLeadBody.leads?.map((l) => l.candidateFullName),
  );

  // ===== 5) Çankaya'ya geç — Mezitli'nin verisi ASLA görünmemeli (RLS izolasyonu) =====
  const actAsCankayaRes = await fetch(`${BASE}/api/hq/acting-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ tenantId: cankaya.id }),
  });
  const cankayaActingCookie = (actAsCankayaRes.headers.get("set-cookie") || "").split(";")[0];
  const superadminActingAsCankaya = mergeCookies(superadminCookie, cankayaActingCookie);

  const cankayaLeadsRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: superadminActingAsCankaya } });
  const cankayaLeadsBody = await cankayaLeadsRes.json();
  check(
    "SUPERADMIN(Çankaya), Mezitli'nin lead'ini GÖRMÜYOR (tenant izolasyonu)",
    !cankayaLeadsBody.leads?.some((l) => l.candidateFullName === uniqueName),
    cankayaLeadsBody.leads?.map((l) => l.candidateFullName),
  );

  const [cankayaAdminLeadsRes] = await Promise.all([
    fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: cankayaAdminCookie } }),
  ]);
  const cankayaAdminLeadsBody = await cankayaAdminLeadsRes.json();
  check(
    "SUPERADMIN(Çankaya), gerçek Çankaya admin'iyle AYNI lead sayısını görür",
    cankayaLeadsBody.leads?.length === cankayaAdminLeadsBody.leads?.length,
    { superadmin: cankayaLeadsBody.leads?.length, cankayaAdmin: cankayaAdminLeadsBody.leads?.length },
  );

  // ===== 6) Şubeden çık — tekrar 403 alınmalı =====
  const exitRes = await fetch(`${BASE}/api/hq/acting-tenant`, { method: "DELETE", headers: { Cookie: superadminCookie } });
  check("Şubeden Çık (DELETE) 200 dönüyor", exitRes.status === 200, exitRes.status);
  const exitCookie = (exitRes.headers.get("set-cookie") || "").split(";")[0];
  const superadminAfterExit = mergeCookies(superadminCookie, exitCookie);

  const afterExitRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: superadminAfterExit } });
  check("Şubeden çıktıktan sonra tekrar 403 alınıyor", afterExitRes.status === 403, afterExitRes.status);

  // ===== 7) Regresyon: normal BRANCH_ADMIN/TEACHER akışı etkilenmemiş =====
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const teacherLeadsRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: teacherCookie } });
  check("Regresyon: TEACHER CRM'e hâlâ 403 alır", teacherLeadsRes.status === 403, teacherLeadsRes.status);
  check(
    "Regresyon: gerçek Mezitli admin'i hâlâ normal şekilde erişebiliyor",
    mezitliAdminLeadsRes.status === 200,
    mezitliAdminLeadsRes.status,
  );

  // ===== Temizlik =====
  if (dbLead) await prisma.crmLead.delete({ where: { id: dbLead.id } });
  const remaining = await prisma.crmLead.count({ where: { candidateFullName: uniqueName } });
  check("Temizlik: test lead'i kalmadı", remaining === 0, remaining);

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
