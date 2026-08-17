// CRM modülünün GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması.
// Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu
// (localhost:3000) çalışıyor olmalı. Yeni bir Prisma modeli (CrmLead) eklendi
// — bkz. prisma/migrations/20260729183745_add_crm_leads ve
// .../20260729183755_add_crm_lead_rls.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN/GUIDANCE_COORDINATOR görebilir/oluşturabilir
//      (TEACHER 403); başka bir şubenin adayına erişim 404 (tenant izolasyonu).
//   2. Oluşturma + listeleme + stage filtresi.
//   3. PATCH ile düzenleme ve aşama (stage) değişimi.
//   4. "KAYIT_OLDU"ya taşındığında otomatik bir Enrollment(ON_KAYIT)
//      oluştuğu ve idempotent olduğu (tekrar KAYIT_OLDU'ya taşımak ikinci
//      bir Enrollment oluşturmuyor).
//   5. Enrollment'a dönüşmüş bir adayın SİLİNEMEDİĞİ (409); dönüşmemiş bir
//      adayın GERÇEKTEN silinebildiği (Enrollment'ın aksine soft-cancel değil).
//   6. Aktivite Akışı'na yansıma.
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
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: tüm roller için giriş başarılı", !!branchAdminCookie && !!teacherCookie && !!otherBranchAdminCookie);

  const noAuthRes = await fetch(`${BASE}/api/branch/crm-leads`);
  check("GET crm-leads: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const teacherListRes = await fetch(`${BASE}/api/branch/crm-leads`, { headers: { Cookie: teacherCookie } });
  check("TEACHER listeleyemez: 403", teacherListRes.status === 403, teacherListRes.status);

  const teacherCreateRes = await fetch(`${BASE}/api/branch/crm-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ candidateFullName: "X Y", candidateGradeLevel: "SINIF_9", guardianFullName: "V V", guardianPhone: "0500" }),
  });
  check("TEACHER oluşturamaz: 403", teacherCreateRes.status === 403, teacherCreateRes.status);

  // ===== Oluşturma =====
  const uniqueName = `Test Aday ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/branch/crm-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      candidateFullName: uniqueName,
      candidateGradeLevel: "SINIF_9",
      guardianFullName: "Test Veli",
      guardianPhone: "05551112233",
      school: "Test Ortaokulu",
      guardianEmail: "test.veli@example.com",
      notes: "İlk görüşme notu",
    }),
  });
  const createBody = await createRes.json();
  check("POST crm-leads: 201", createRes.status === 201, createRes.status);
  const leadId = createBody.lead?.id;
  check("Oluşturulan stage=ARANDI", createBody.lead?.stage === "ARANDI", createBody.lead?.stage);

  // ===== stage filtresi =====
  const filteredRes = await fetch(`${BASE}/api/branch/crm-leads?stage=ARANDI`, { headers: { Cookie: branchAdminCookie } });
  const filteredBody = await filteredRes.json();
  check("stage filtresi: yeni aday listede", filteredBody.leads?.some((l) => l.id === leadId));

  // ===== Çapraz-tenant izolasyonu =====
  const crossPatchRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: otherBranchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05559998877" }),
  });
  check("Çankaya admin Mezitli adayını düzenleyemez: 404", crossPatchRes.status === 404, crossPatchRes.status);

  // ===== Düzenleme (PATCH) =====
  const patchRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05559998877" }),
  });
  const patchBody = await patchRes.json();
  check("PATCH: 200 + telefon güncellendi", patchRes.status === 200 && patchBody.lead?.guardianPhone === "05559998877", patchBody.lead?.guardianPhone);

  // ===== Düzenleme (PATCH): school + guardianEmail — edit formuna eklendi =====
  const patchSchoolRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ school: "Yeni Ortaokul", guardianEmail: "yeni.veli@example.com" }),
  });
  const patchSchoolBody = await patchSchoolRes.json();
  check(
    "PATCH: 200 + school/guardianEmail güncellendi",
    patchSchoolRes.status === 200 && patchSchoolBody.lead?.school === "Yeni Ortaokul" && patchSchoolBody.lead?.guardianEmail === "yeni.veli@example.com",
    patchSchoolBody.lead,
  );

  // ===== Aşama ilerletme: ARANDI → GORUSULDU → DENEME_SINAVINA_GIRDI =====
  const stage1Res = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ stage: "GORUSULDU" }),
  });
  const stage1Body = await stage1Res.json();
  check("Aşama GORUSULDU'ya taşındı", stage1Body.lead?.stage === "GORUSULDU", stage1Body.lead?.stage);

  const stage2Res = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ stage: "DENEME_SINAVINA_GIRDI" }),
  });
  const stage2Body = await stage2Res.json();
  check("Aşama DENEME_SINAVINA_GIRDI'ya taşındı, henüz enrollmentId yok", stage2Body.lead?.stage === "DENEME_SINAVINA_GIRDI" && !stage2Body.lead?.enrollmentId);

  // ===== KAYIT_OLDU: otomatik Enrollment oluşturulur =====
  const convertRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ stage: "KAYIT_OLDU" }),
  });
  const convertBody = await convertRes.json();
  check("KAYIT_OLDU: enrollmentId oluştu", !!convertBody.lead?.enrollmentId, convertBody.lead?.enrollmentId);

  const dbEnrollment = await prisma.enrollment.findUnique({ where: { id: convertBody.lead.enrollmentId } });
  check(
    "Oluşturulan Enrollment doğru aday bilgileriyle (ON_KAYIT, aynı isim)",
    dbEnrollment?.type === "ON_KAYIT" && dbEnrollment?.candidateFullName === uniqueName,
    JSON.stringify({ type: dbEnrollment?.type, name: dbEnrollment?.candidateFullName }),
  );

  // ===== İdempotentlik: tekrar KAYIT_OLDU'ya taşımak ikinci Enrollment oluşturmuyor =====
  const reConvertRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ stage: "KAYIT_OLDU" }),
  });
  const reConvertBody = await reConvertRes.json();
  check(
    "Tekrar KAYIT_OLDU: aynı enrollmentId korunuyor (ikinci Enrollment yok)",
    reConvertBody.lead?.enrollmentId === convertBody.lead.enrollmentId,
  );
  const enrollmentCountForLead = await prisma.enrollment.count({ where: { candidateFullName: uniqueName } });
  check("DB'de bu aday için yalnızca 1 Enrollment var", enrollmentCountForLead === 1, enrollmentCountForLead);

  // ===== Dönüşmüş aday silinemez =====
  const deleteConvertedRes = await fetch(`${BASE}/api/branch/crm-leads/${leadId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Dönüşmüş aday silinemez: 409", deleteConvertedRes.status === 409, deleteConvertedRes.status);

  // ===== İkinci aday: dönüşmemiş, gerçekten silinebilir =====
  const secondName = `Test Silinecek ${Date.now()}`;
  const createSecondRes = await fetch(`${BASE}/api/branch/crm-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ candidateFullName: secondName, candidateGradeLevel: "SINIF_10", guardianFullName: "Veli İki", guardianPhone: "05552223344" }),
  });
  const createSecondBody = await createSecondRes.json();
  const secondId = createSecondBody.lead?.id;

  const deleteSecondRes = await fetch(`${BASE}/api/branch/crm-leads/${secondId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Dönüşmemiş aday GERÇEKTEN silinir: 200", deleteSecondRes.status === 200, deleteSecondRes.status);
  const dbSecond = await prisma.crmLead.findUnique({ where: { id: secondId } });
  check("Silinen satır DB'de artık yok (hard delete)", dbSecond === null);

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => e.action);
  check("Aktivite Akışı: CRM adayı eklendi", actions.includes("CRM adayı eklendi"));
  check("Aktivite Akışı: CRM adayından Ön Kayıt oluşturuldu", actions.includes("CRM adayından Ön Kayıt oluşturuldu"));
  check("Aktivite Akışı: CRM adayı silindi", actions.includes("CRM adayı silindi"));

  // Temizlik — yalnızca bu testin oluşturduğu Enrollment ve Aktivite Akışı kayıtları
  // (CrmLead zaten Enrollment üzerinden FK ile bağlı olduğu için önce Enrollment silinemez,
  // CrmLead.enrollmentId nullable FK olduğundan CrmLead'i de silip ardından Enrollment'ı temizliyoruz).
  await prisma.crmLead.deleteMany({ where: { candidateFullName: uniqueName } });
  await prisma.enrollment.deleteMany({ where: { candidateFullName: uniqueName } });
  await prisma.auditLogEntry.deleteMany({
    where: { action: { in: ["CRM adayı eklendi", "CRM adayı düzenlendi", "CRM adayından Ön Kayıt oluşturuldu", "CRM adayı silindi"] } },
  });

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
