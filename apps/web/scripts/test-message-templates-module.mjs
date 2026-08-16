// İletişim → Hazır Şablonlar modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı. Yeni Prisma modeli
// ekler (MessageTemplate) — bkz. prisma/migrations/20260816131756_add_message_templates.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN/TEACHER şablon listeleyebilir/oluşturabilir/
//      düzenleyebilir/silebilir (STUDENT/PARENT 403, oturumsuz 401).
//   2. CRUD: oluşturma (varsayılan kind/category), listeleme, güncelleme,
//      silme; silinen/var olmayan şablon için 404.
//   3. Tenant izolasyonu: başka bir şubenin oluşturduğu şablon bu şubenin
//      listesinde GÖRÜNMÜYOR.
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
  check("BRANCH_ADMIN (Mezitli) login başarılı", !!branchAdminCookie);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("TEACHER login başarılı", !!teacherCookie);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  check("PARENT login başarılı", !!parentCookie);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  check("STUDENT login başarılı", !!studentCookie);
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Çankaya) login başarılı", !!otherBranchAdminCookie);

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/branch/message-templates`);
  check("GET /api/branch/message-templates: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const studentListRes = await fetch(`${BASE}/api/branch/message-templates`, { headers: { Cookie: studentCookie } });
  check("STUDENT listeleyemez: 403", studentListRes.status === 403, studentListRes.status);

  const parentCreateRes = await fetch(`${BASE}/api/branch/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ title: "x", body: "y" }),
  });
  check("PARENT oluşturamaz: 403", parentCreateRes.status === 403, parentCreateRes.status);

  // ===== Eksik alan doğrulaması =====
  const missingFieldsRes = await fetch(`${BASE}/api/branch/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "  " }),
  });
  check("Eksik body alanı: 400", missingFieldsRes.status === 400, missingFieldsRes.status);

  // ===== BRANCH_ADMIN oluşturma (varsayılan kind/category) =====
  const createRes = await fetch(`${BASE}/api/branch/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "Ödeme Hatırlatma", body: "Bu ayki taksitiniz için son ödeme tarihi yaklaşıyor." }),
  });
  const createBody = await createRes.json();
  check("POST: 201 dönüyor", createRes.status === 201, createRes.status);
  check("Varsayılan kind='mesaj'", createBody.template?.kind === "mesaj", createBody.template?.kind);
  check("Varsayılan category='Genel'", createBody.template?.category === "Genel", createBody.template?.category);
  const templateId = createBody.template.id;

  // ===== TEACHER oluşturma (açık kind/category) =====
  const teacherCreateRes = await fetch(`${BASE}/api/branch/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ kind: "bildirim", category: "Sınav", title: "Sınav Duyurusu", body: "Yarınki sınav saat 10:00'da." }),
  });
  const teacherCreateBody = await teacherCreateRes.json();
  check("TEACHER oluşturabilir: 201", teacherCreateRes.status === 201, teacherCreateRes.status);
  check("TEACHER'ın kind='bildirim' değeri korunuyor", teacherCreateBody.template?.kind === "bildirim", teacherCreateBody.template?.kind);
  const teacherTemplateId = teacherCreateBody.template.id;

  // ===== Listeleme =====
  const listRes = await fetch(`${BASE}/api/branch/message-templates`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("Listede BRANCH_ADMIN'in şablonu var", listBody.templates?.some((t) => t.id === templateId));
  check("Listede TEACHER'ın şablonu da var (aynı şube)", listBody.templates?.some((t) => t.id === teacherTemplateId));

  // ===== Güncelleme =====
  const updateRes = await fetch(`${BASE}/api/branch/message-templates/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "Ödeme Hatırlatma (Güncel)", category: "Ödeme" }),
  });
  const updateBody = await updateRes.json();
  check("PATCH: 200 dönüyor", updateRes.status === 200, updateRes.status);
  check("Başlık güncellendi", updateBody.template?.title === "Ödeme Hatırlatma (Güncel)", updateBody.template?.title);
  check("Kategori güncellendi", updateBody.template?.category === "Ödeme", updateBody.template?.category);
  check("Güncellenmeyen body alanı korundu", updateBody.template?.body === "Bu ayki taksitiniz için son ödeme tarihi yaklaşıyor.");

  const studentUpdateRes = await fetch(`${BASE}/api/branch/message-templates/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ title: "x" }),
  });
  check("STUDENT güncelleyemez: 403", studentUpdateRes.status === 403, studentUpdateRes.status);

  // ===== Tenant izolasyonu =====
  const otherCreateRes = await fetch(`${BASE}/api/branch/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: otherBranchAdminCookie },
    body: JSON.stringify({ title: "Çankaya Şablonu", body: "Bu yalnızca Çankaya şubesine ait olmalı." }),
  });
  const otherCreateBody = await otherCreateRes.json();
  check("Çankaya şablonu 201 ile oluşturuldu", otherCreateRes.status === 201, otherCreateRes.status);

  const listAfterOtherRes = await fetch(`${BASE}/api/branch/message-templates`, { headers: { Cookie: branchAdminCookie } });
  const listAfterOtherBody = await listAfterOtherRes.json();
  check(
    "Mezitli listesinde Çankaya şablonu YOK (tenant izolasyonu)",
    !listAfterOtherBody.templates?.some((t) => t.id === otherCreateBody.template.id),
  );

  const crossTenantUpdateRes = await fetch(`${BASE}/api/branch/message-templates/${otherCreateBody.template.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "ele geçirilmeye çalışıldı" }),
  });
  check(
    "Mezitli, Çankaya'nın şablonunu güncelleyemez: 404",
    crossTenantUpdateRes.status === 404,
    crossTenantUpdateRes.status,
  );

  // ===== Silme =====
  const deleteRes = await fetch(`${BASE}/api/branch/message-templates/${templateId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE: 200 dönüyor", deleteRes.status === 200, deleteRes.status);

  const listAfterDeleteRes = await fetch(`${BASE}/api/branch/message-templates`, { headers: { Cookie: branchAdminCookie } });
  const listAfterDeleteBody = await listAfterDeleteRes.json();
  check("Silinen şablon listede yok", !listAfterDeleteBody.templates?.some((t) => t.id === templateId));

  const deleteAgainRes = await fetch(`${BASE}/api/branch/message-templates/${templateId}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("Zaten silinmiş şablon için 404", deleteAgainRes.status === 404, deleteAgainRes.status);

  // Temizlik
  await prisma.messageTemplate.deleteMany({ where: { id: { in: [teacherTemplateId, otherCreateBody.template.id] } } });

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
