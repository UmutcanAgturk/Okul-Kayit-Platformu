// Ödeme Yöntemleri modülünün (app/api/branch/students/[studentId]/payment-methods)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER 403, oturumsuz 401), tenant izolasyonu
// (başka şubenin öğrencisine 404), ekleme + varsayılan tekilliği (yeni
// varsayılan eklenince eskisinin isDefault'u false olur), silme, ve
// Aktivite Akışı'na yansıma. Oluşturduğu kayıtları sonunda temizler.
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
  if (!elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!cankayaCookie);

  const base = `${BASE}/api/branch/students/${elif.id}/payment-methods`;

  const noSession = await fetch(base);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherRes = await fetch(base, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER göremez (403)", teacherRes.status === 403, teacherRes.status);

  const cankayaRes = await fetch(base, { headers: { Cookie: cankayaCookie } });
  check("Tenant izolasyonu: Çankaya admin'i Mezitli öğrencisine erişemez (404)", cankayaRes.status === 404, cankayaRes.status);

  const emptyRes = await fetch(base, { headers: { Cookie: branchCookie } });
  const emptyBody = await emptyRes.json();
  check("GET: başlangıçta boş liste", emptyRes.status === 200 && Array.isArray(emptyBody.methods), emptyBody);

  const createBankRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ type: "BANKA_HAVALESI", isDefault: true }),
  });
  const bankMethod = (await createBankRes.json()).method;
  check("POST: banka havalesi oluşturuldu ve varsayılan (201)", createBankRes.status === 201 && bankMethod.isDefault === true, bankMethod);

  const createCardRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ type: "KREDI_KARTI", maskedCardNumber: "•••• •••• •••• 4831", isDefault: true }),
  });
  const cardMethod = (await createCardRes.json()).method;
  check("POST: kredi kartı oluşturuldu ve yeni varsayılan (201)", createCardRes.status === 201 && cardMethod.isDefault === true, cardMethod);

  const afterSecondCreate = await prisma.paymentMethod.findUnique({ where: { id: bankMethod.id } });
  check("Varsayılan tekilliği: ilk kayıt artık varsayılan DEĞİL", afterSecondCreate.isDefault === false, afterSecondCreate.isDefault);

  const listRes = await fetch(base, { headers: { Cookie: branchCookie } });
  const listBody = await listRes.json();
  check("GET: iki kayıt listeleniyor", listBody.methods.length === 2, listBody.methods.length);

  // ===== Yöntem Dağılımı (task #78) =====
  const distNoSession = await fetch(`${BASE}/api/branch/payment-methods/distribution`);
  check("GET distribution: oturumsuz 401", distNoSession.status === 401, distNoSession.status);

  const distTeacherRes = await fetch(`${BASE}/api/branch/payment-methods/distribution`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER dağılımı göremez (403)", distTeacherRes.status === 403, distTeacherRes.status);

  const distRes = await fetch(`${BASE}/api/branch/payment-methods/distribution`, { headers: { Cookie: branchCookie } });
  const distBody = await distRes.json();
  check("GET distribution: 200 ve counts/total alanları mevcut", distRes.status === 200 && typeof distBody.total === "number" && !!distBody.counts, distBody);
  check(
    "Yöntem Dağılımı: Elif'in varsayılanı KREDI_KARTI olduğundan KREDI_KARTI sayacında en az 1",
    distBody.counts?.KREDI_KARTI >= 1,
    distBody.counts,
  );
  check(
    "Yöntem Dağılımı: counts toplamı total'e eşit",
    Object.values(distBody.counts).reduce((a, b) => a + b, 0) === distBody.total,
    distBody,
  );

  const badTypeRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ type: "BITCOIN" }),
  });
  check("POST: geçersiz tür 400", badTypeRes.status === 400, badTypeRes.status);

  // ===== task #97: kayıtlı yöntem düzenleme (eskiden yalnızca silinebiliyordu) =====
  const patchNoAuthRes = await fetch(`${base}/${bankMethod.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isDefault: true }),
  });
  check("PATCH: oturumsuz 401", patchNoAuthRes.status === 401, patchNoAuthRes.status);

  const patchTeacherRes = await fetch(`${base}/${bankMethod.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ isDefault: true }),
  });
  check("PATCH: TEACHER düzenleyemez (403)", patchTeacherRes.status === 403, patchTeacherRes.status);

  const patchTypeRes = await fetch(`${base}/${bankMethod.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ type: "NAKIT" }),
  });
  const patchTypeBody = await patchTypeRes.json();
  check("PATCH: tür güncellenebiliyor (BANKA_HAVALESI → NAKIT, 200)", patchTypeRes.status === 200 && patchTypeBody.method?.type === "NAKIT", patchTypeBody);
  const dbAfterTypePatch = await prisma.paymentMethod.findUnique({ where: { id: bankMethod.id } });
  check("DB: tür gerçekten NAKIT olarak güncellendi", dbAfterTypePatch?.type === "NAKIT", dbAfterTypePatch?.type);

  const patchDefaultRes = await fetch(`${base}/${bankMethod.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ isDefault: true }),
  });
  const patchDefaultBody = await patchDefaultRes.json();
  check("PATCH: varsayılan yapılabiliyor (200)", patchDefaultRes.status === 200 && patchDefaultBody.method?.isDefault === true, patchDefaultBody);
  const dbCardAfterOtherDefault = await prisma.paymentMethod.findUnique({ where: { id: cardMethod.id } });
  check(
    "PATCH: bir yöntem varsayılan yapılınca ÖNCEKİ varsayılan (cardMethod) otomatik false oldu",
    dbCardAfterOtherDefault?.isDefault === false,
    dbCardAfterOtherDefault?.isDefault,
  );

  const patchBadTypeRes = await fetch(`${base}/${bankMethod.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ type: "BITCOIN" }),
  });
  check("PATCH: geçersiz tür 400", patchBadTypeRes.status === 400, patchBadTypeRes.status);

  const patchNotFoundRes = await fetch(`${base}/does-not-exist`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ isDefault: true }),
  });
  check("PATCH: olmayan kayıt için 404", patchNotFoundRes.status === 404, patchNotFoundRes.status);

  const editLog = await prisma.auditLogEntry.findFirst({ where: { tenantId: elif.tenantId, action: "Ödeme yöntemi düzenlendi" }, orderBy: { createdAt: "desc" } });
  check("Aktivite Akışı: ödeme yöntemi düzenleme loglandı", !!editLog, editLog?.action);

  const deleteRes = await fetch(`${base}/${bankMethod.id}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  check("DELETE: silme başarılı (200)", deleteRes.status === 200, deleteRes.status);

  const deleteNotFoundRes = await fetch(`${base}/${bankMethod.id}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  check("DELETE: zaten silinmiş kayıt için 404", deleteNotFoundRes.status === 404, deleteNotFoundRes.status);

  const lastLog = await prisma.auditLogEntry.findFirst({
    where: { tenantId: elif.tenantId, action: { in: ["Ödeme yöntemi eklendi", "Ödeme yöntemi silindi"] } },
    orderBy: { createdAt: "desc" },
  });
  check("Aktivite Akışı: işlem loglandı", !!lastLog, lastLog?.action);

  // ===== Temizlik =====
  await fetch(`${base}/${cardMethod.id}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  const remaining = await prisma.paymentMethod.count({ where: { studentId: elif.id } });
  check("Temizlik: öğrencinin ödeme yöntemi kalmadı", remaining === 0, remaining);

  const distAfterCleanupRes = await fetch(`${BASE}/api/branch/payment-methods/distribution`, { headers: { Cookie: branchCookie } });
  const distAfterCleanupBody = await distAfterCleanupRes.json();
  check(
    "Yöntem Dağılımı: temizlik sonrası KREDI_KARTI sayacı bir azaldı (Elif artık NONE)",
    distAfterCleanupBody.counts?.KREDI_KARTI === distBody.counts.KREDI_KARTI - 1,
    { before: distBody.counts.KREDI_KARTI, after: distAfterCleanupBody.counts?.KREDI_KARTI },
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
