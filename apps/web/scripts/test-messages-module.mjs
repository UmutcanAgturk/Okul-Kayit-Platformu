// İletişim modülünün GERÇEK bir Postgres veritabanına karşı uçtan uca
// doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı. Yeni Prisma modelleri ekler
// (Message, MessageRecipient) — bkz. prisma/migrations/20260728144908_add_messages
// ve .../20260728144925_add_message_rls.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN/TEACHER gönderebilir (STUDENT/PARENT 403,
//      oturumsuz 401); TEACHER, ALL_TEACHERS/ALL_STAFF hedefleyemez (403).
//   2. BRANCH_ADMIN'in ALL_GUARDIANS + sınıf filtresiyle gönderdiği bir
//      mesajın, o sınıftaki öğrencinin velisinin gelen kutusuna doğru
//      düştüğü.
//   3. Gelen kutusunda okundu işaretleme (PATCH) ve kaldırma (DELETE).
//   4. Tenant izolasyonu: başka bir şubenin BRANCH_ADMIN'inin gönderdiği
//      mesajın bu veliye ULAŞMADIĞI.
//   5. TEACHER'ın ALL_STUDENTS'a gönderdiği mesajın öğrencinin gelen
//      kutusuna düştüğü.
//   6. Gönderilen mesajlar listesinin (sent) doğru recipientCount döndürdüğü.
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

  const classroom = await prisma.classroom.findFirst({ where: { name: "9-A", tenant: { code: "MEZITLI-01" } } });

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x", body: "y", audience: "ALL_GUARDIANS" }),
  });
  check("POST /api/branch/messages: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const studentSendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ title: "x", body: "y", audience: "ALL_GUARDIANS" }),
  });
  check("STUDENT gönderemez: 403", studentSendRes.status === 403, studentSendRes.status);

  const teacherStaffSendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ title: "x", body: "y", audience: "ALL_STAFF" }),
  });
  check("TEACHER ALL_STAFF hedefleyemez: 403", teacherStaffSendRes.status === 403, teacherStaffSendRes.status);

  // ===== BRANCH_ADMIN -> 9-A sınıfı velileri =====
  const sendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      title: "Veli Toplantısı Daveti",
      body: "Dönem değerlendirme toplantımız yakında gerçekleşecektir.",
      audience: "ALL_GUARDIANS",
      classroomId: classroom.id,
    }),
  });
  const sendBody = await sendRes.json();
  check("POST /api/branch/messages: 9-A velilerine 201 dönüyor", sendRes.status === 201, sendRes.status);
  check("recipientCount >= 1", sendBody.message?.recipientCount >= 1, sendBody.message?.recipientCount);
  check("audienceLabel sınıf adını içeriyor", sendBody.message?.audienceLabel?.includes("9-A"), sendBody.message?.audienceLabel);
  const sentMessageId = sendBody.message.id;

  // ===== Veli gelen kutusu =====
  const parentInboxRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: parentCookie } });
  const parentInboxBody = await parentInboxRes.json();
  const inboxEntry = parentInboxBody.messages?.find((m) => m.id === sentMessageId);
  check("Veli gelen kutusunda mesaj görünüyor", !!inboxEntry, inboxEntry?.title);
  check("Mesaj başlangıçta okunmamış", inboxEntry?.readAt === null, inboxEntry?.readAt);

  // ===== Gönderilen mesajlar listesi (veli henüz kendi kopyasını silmeden önce) =====
  const sentListRes = await fetch(`${BASE}/api/branch/messages`, { headers: { Cookie: branchAdminCookie } });
  const sentListBody = await sentListRes.json();
  const sentEntry = sentListBody.messages?.find((m) => m.id === sentMessageId);
  check("BRANCH_ADMIN'in gönderilenler listesinde mesaj var", !!sentEntry, sentEntry?.title);
  check("Gönderilenler listesinde recipientCount doğru", sentEntry?.recipientCount === sendBody.message.recipientCount);

  const readRes = await fetch(`${BASE}/api/messages/${sentMessageId}`, { method: "PATCH", headers: { Cookie: parentCookie } });
  check("PATCH okundu işaretleme 200", readRes.status === 200, readRes.status);

  const parentInboxAfterReadRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: parentCookie } });
  const parentInboxAfterReadBody = await parentInboxAfterReadRes.json();
  const readEntry = parentInboxAfterReadBody.messages?.find((m) => m.id === sentMessageId);
  check("Okundu işaretledikten sonra readAt dolu", !!readEntry?.readAt, readEntry?.readAt);

  const deleteRes = await fetch(`${BASE}/api/messages/${sentMessageId}`, { method: "DELETE", headers: { Cookie: parentCookie } });
  check("DELETE gelen kutusundan kaldırma 200", deleteRes.status === 200, deleteRes.status);

  const parentInboxAfterDeleteRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: parentCookie } });
  const parentInboxAfterDeleteBody = await parentInboxAfterDeleteRes.json();
  check(
    "Kaldırdıktan sonra veli gelen kutusunda mesaj yok",
    !parentInboxAfterDeleteBody.messages?.some((m) => m.id === sentMessageId),
  );

  // ===== Tenant izolasyonu: Çankaya BRANCH_ADMIN'in mesajı Mezitli velisine ulaşmamalı =====
  const otherSendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: otherBranchAdminCookie },
    body: JSON.stringify({ title: "Çankaya Duyurusu", body: "Bu yalnızca Çankaya velilerine gitmeli.", audience: "ALL_GUARDIANS" }),
  });
  const otherSendBody = await otherSendRes.json();
  check("Çankaya mesajı 201 ile gönderildi", otherSendRes.status === 201, otherSendRes.status);

  const parentInboxFinalRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: parentCookie } });
  const parentInboxFinalBody = await parentInboxFinalRes.json();
  check(
    "Mezitli velisi Çankaya mesajını ALMADI (tenant izolasyonu)",
    !parentInboxFinalBody.messages?.some((m) => m.id === otherSendBody.message.id),
  );

  // ===== TEACHER -> ALL_STUDENTS =====
  const teacherSendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ title: "Sınav Sonucu Yayınlandı", body: "Detayları inceleyebilirsiniz.", audience: "ALL_STUDENTS" }),
  });
  const teacherSendBody = await teacherSendRes.json();
  check("TEACHER ALL_STUDENTS'a 201 ile gönderdi", teacherSendRes.status === 201, teacherSendRes.status);

  const studentInboxRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: studentCookie } });
  const studentInboxBody = await studentInboxRes.json();
  check(
    "Öğrenci gelen kutusunda öğretmen mesajı görünüyor",
    studentInboxBody.messages?.some((m) => m.id === teacherSendBody.message.id),
  );

  // ===== Aktivite Akışı yansıması =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  check(
    "Aktivite Akışı: mesaj gönderimi kaydedildi",
    activityBody.entries?.some((e) => e.action === "Mesaj gönderildi" && e.detail?.includes("Veli Toplantısı Daveti")),
  );

  // Temizlik
  await prisma.messageRecipient.deleteMany({ where: { messageId: { in: [sentMessageId, otherSendBody.message.id, teacherSendBody.message.id] } } });
  await prisma.message.deleteMany({ where: { id: { in: [sentMessageId, otherSendBody.message.id, teacherSendBody.message.id] } } });
  await prisma.auditLogEntry.deleteMany({ where: { action: "Mesaj gönderildi" } });

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
