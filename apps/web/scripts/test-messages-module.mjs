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
//   8. task #58: mesaja dosya eki eklenebildiği (POST/GET sent + GET inbox'ta
//      dataUrl'in geri döndüğü, bir mesajın BİRDEN FAZLA eki olabildiği),
//      desteklenmeyen MIME türünün ve boyut limitini aşan bir dosyanın 400
//      ile reddedildiği.
//   9. task #89: gönderenin kendi mesajını geri çekebildiği (mesaj TÜM
//      alıcılardan siliniyor), gönderen olmayanın 403 aldığı, zaten geri
//      çekilmiş bir mesajı tekrar geri çekmenin 404 döndürdüğü.
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

  // ===== task #58: desteklenmeyen MIME / boyut limiti reddedilir =====
  const badMimeRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      title: "x",
      body: "y",
      audience: "ALL_GUARDIANS",
      attachments: [{ fileName: "virus.exe", mimeType: "application/x-msdownload", dataUrl: "data:application/x-msdownload;base64,AAAA" }],
    }),
  });
  check("Desteklenmeyen MIME türü 400 ile reddediliyor", badMimeRes.status === 400, badMimeRes.status);

  const tooBigRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      title: "x",
      body: "y",
      audience: "ALL_GUARDIANS",
      attachments: [{ fileName: "buyuk.png", mimeType: "image/png", dataUrl: "data:image/png;base64," + "A".repeat(3_600_000) }],
    }),
  });
  check("Boyut limitini aşan dosya 400 ile reddediliyor", tooBigRes.status === 400, tooBigRes.status);

  // ===== BRANCH_ADMIN -> 9-A sınıfı velileri (iki ek dosyayla) =====
  const testAttachments = [
    { fileName: "toplanti-gundemi.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,JVBERi0xLjQK" },
    { fileName: "afis.png", mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" },
  ];
  const sendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      title: "Veli Toplantısı Daveti",
      body: "Dönem değerlendirme toplantımız yakında gerçekleşecektir.",
      audience: "ALL_GUARDIANS",
      classroomId: classroom.id,
      attachments: testAttachments,
    }),
  });
  const sendBody = await sendRes.json();
  check("POST /api/branch/messages: 9-A velilerine 201 dönüyor", sendRes.status === 201, sendRes.status);
  check("recipientCount >= 1", sendBody.message?.recipientCount >= 1, sendBody.message?.recipientCount);
  check("audienceLabel sınıf adını içeriyor", sendBody.message?.audienceLabel?.includes("9-A"), sendBody.message?.audienceLabel);
  check("POST yanıtında 2 ek dönüyor", sendBody.message?.attachments?.length === 2, sendBody.message?.attachments?.length);
  const sentMessageId = sendBody.message.id;

  // ===== Veli gelen kutusu =====
  const parentInboxRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: parentCookie } });
  const parentInboxBody = await parentInboxRes.json();
  const inboxEntry = parentInboxBody.messages?.find((m) => m.id === sentMessageId);
  check("Veli gelen kutusunda mesaj görünüyor", !!inboxEntry, inboxEntry?.title);
  check("Mesaj başlangıçta okunmamış", inboxEntry?.readAt === null, inboxEntry?.readAt);
  check("Veli gelen kutusunda 2 ek görünüyor", inboxEntry?.attachments?.length === 2, inboxEntry?.attachments?.length);
  check(
    "Ek dataUrl'i eksiksiz geri dönüyor",
    inboxEntry?.attachments?.[0]?.dataUrl === testAttachments[0].dataUrl,
    inboxEntry?.attachments?.[0]?.dataUrl?.slice(0, 30),
  );

  // ===== Gönderilen mesajlar listesi (veli henüz kendi kopyasını silmeden önce) =====
  const sentListRes = await fetch(`${BASE}/api/branch/messages`, { headers: { Cookie: branchAdminCookie } });
  const sentListBody = await sentListRes.json();
  const sentEntry = sentListBody.messages?.find((m) => m.id === sentMessageId);
  check("BRANCH_ADMIN'in gönderilenler listesinde mesaj var", !!sentEntry, sentEntry?.title);
  check("Gönderilenler listesinde recipientCount doğru", sentEntry?.recipientCount === sendBody.message.recipientCount);
  check("Gönderilenler listesinde 2 ek görünüyor", sentEntry?.attachments?.length === 2, sentEntry?.attachments?.length);

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

  // ===== task #89: mesaj geri çekme =====
  const notSenderRecallRes = await fetch(`${BASE}/api/branch/messages/${teacherSendBody.message.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("Gönderen olmayan geri çekemez: 403", notSenderRecallRes.status === 403, notSenderRecallRes.status);

  const studentInboxBeforeRecallRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: studentCookie } });
  const studentInboxBeforeRecallBody = await studentInboxBeforeRecallRes.json();
  check(
    "Geri çekmeden önce öğrenci gelen kutusunda mesaj hâlâ var",
    studentInboxBeforeRecallBody.messages?.some((m) => m.id === teacherSendBody.message.id),
  );

  const recallRes = await fetch(`${BASE}/api/branch/messages/${teacherSendBody.message.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Gönderen kendi mesajını geri çekebilir: 200", recallRes.status === 200, recallRes.status);

  const studentInboxAfterRecallRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: studentCookie } });
  const studentInboxAfterRecallBody = await studentInboxAfterRecallRes.json();
  check(
    "Geri çektikten sonra öğrenci gelen kutusunda mesaj YOK",
    !studentInboxAfterRecallBody.messages?.some((m) => m.id === teacherSendBody.message.id),
  );

  const teacherSentAfterRecallRes = await fetch(`${BASE}/api/branch/messages`, { headers: { Cookie: teacherCookie } });
  const teacherSentAfterRecallBody = await teacherSentAfterRecallRes.json();
  check(
    "Geri çektikten sonra gönderenin gönderilenler listesinde de YOK",
    !teacherSentAfterRecallBody.messages?.some((m) => m.id === teacherSendBody.message.id),
  );

  const doubleRecallRes = await fetch(`${BASE}/api/branch/messages/${teacherSendBody.message.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Zaten geri çekilmiş mesajı tekrar geri çekmek: 404", doubleRecallRes.status === 404, doubleRecallRes.status);

  const recallNoAuthRes = await fetch(`${BASE}/api/branch/messages/${sentMessageId}`, { method: "DELETE" });
  check("Geri çekme: oturumsuz 401", recallNoAuthRes.status === 401, recallNoAuthRes.status);

  // ===== task #101: tekil öğrenci seçimi (students-search + studentIds) =====
  const searchNoAuthRes = await fetch(`${BASE}/api/branch/messages/students-search?q=el`);
  check("GET students-search: oturumsuz 401", searchNoAuthRes.status === 401, searchNoAuthRes.status);

  const searchParentRes = await fetch(`${BASE}/api/branch/messages/students-search?q=el`, { headers: { Cookie: parentCookie } });
  check("Yetki: PARENT öğrenci arayamaz (403)", searchParentRes.status === 403, searchParentRes.status);

  const searchTooShortRes = await fetch(`${BASE}/api/branch/messages/students-search?q=e`, { headers: { Cookie: teacherCookie } });
  const searchTooShortBody = await searchTooShortRes.json();
  check("GET students-search: 1 karakter boş liste döner", searchTooShortRes.status === 200 && searchTooShortBody.students?.length === 0, searchTooShortBody);

  const searchRes = await fetch(`${BASE}/api/branch/messages/students-search?q=Elif`, { headers: { Cookie: teacherCookie } });
  const searchBody = await searchRes.json();
  const elifSearchResult = searchBody.students?.find((s) => s.name === "Elif Yılmaz");
  check("GET students-search: Elif Yılmaz sonuçlarda (studentNo/classroomName ile)", !!elifSearchResult && !!elifSearchResult.studentNo, elifSearchResult);

  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  const classroomStudentCount = await prisma.studentProfile.count({ where: { classroomId: classroom.id } });
  check("Kurulum: 9-A sınıfında birden fazla öğrenci var (daraltma testi için)", classroomStudentCount > 1, classroomStudentCount);

  // Not: audience=ALL_STUDENTS kullanılır (ALL_GUARDIANS değil) çünkü 9-A'daki
  // TEK veli kaydı Elif'e ait (seed verisi) — ALL_GUARDIANS ile recipientCount=1
  // hem doğru daraltmada HEM YANLIŞLIKLA tüm sınıfa gönderilse bile aynı çıkardı
  // (diğer öğrencilerin velisi yok). ALL_STUDENTS ile 9-A'nın 4 öğrencisi VAR,
  // bu yüzden recipientCount=1 gerçek bir daraltma kanıtı olur (aksi halde 4 olurdu).
  const studentIdSendRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      title: "Tekil Öğrenci Testi",
      body: "Yalnızca Elif'e gitmeli.",
      audience: "ALL_STUDENTS",
      classroomId: classroom.id,
      studentIds: [elif.id],
    }),
  });
  const studentIdSendBody = await studentIdSendRes.json();
  check(
    "POST studentIds ile: 201 ve recipientCount=1 (sınıfın 4 öğrencisi DEĞİL, yalnızca seçilen)",
    studentIdSendRes.status === 201 && studentIdSendBody.message?.recipientCount === 1,
    studentIdSendBody.message,
  );
  check("audienceLabel 'Seçili' ile başlıyor (classroomId göz ardı edildi)", studentIdSendBody.message?.audienceLabel?.startsWith("Seçili"), studentIdSendBody.message?.audienceLabel);

  const dbRecipient = await prisma.messageRecipient.findFirst({ where: { messageId: studentIdSendBody.message.id } });
  check("DB: tek alıcı gerçekten Elif'in kendi User'ı", dbRecipient?.userId === elif.userId, dbRecipient?.userId);

  const badStudentIdRes = await fetch(`${BASE}/api/branch/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "x", body: "y", audience: "ALL_GUARDIANS", studentIds: ["does-not-exist"] }),
  });
  check("POST studentIds: olmayan öğrenci id'si 404", badStudentIdRes.status === 404, badStudentIdRes.status);

  // ===== task #101: HQ Yayını (bare SUPERADMIN, çapraz-tenant) =====
  const superadminCookie = await loginAs("admin@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: SUPERADMIN girişi başarılı", !!superadminCookie);

  const hqMsgNoAuthRes = await fetch(`${BASE}/api/hq/messages`);
  check("GET hq/messages: oturumsuz 401", hqMsgNoAuthRes.status === 401, hqMsgNoAuthRes.status);

  const hqMsgBranchAdminRes = await fetch(`${BASE}/api/hq/messages`, { headers: { Cookie: branchAdminCookie } });
  check("Yetki: BRANCH_ADMIN HQ yayınlarını göremez (403)", hqMsgBranchAdminRes.status === 403, hqMsgBranchAdminRes.status);

  const hqSendBranchAdminRes = await fetch(`${BASE}/api/hq/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ title: "x", body: "y", recipientTypes: ["MANAGERS"] }),
  });
  check("Yetki: BRANCH_ADMIN HQ yayını gönderemez (403)", hqSendBranchAdminRes.status === 403, hqSendBranchAdminRes.status);

  const hqNoTypesRes = await fetch(`${BASE}/api/hq/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ title: "x", body: "y", recipientTypes: [] }),
  });
  check("POST hq/messages: boş recipientTypes 400", hqNoTypesRes.status === 400, hqNoTypesRes.status);

  const hqSendRes = await fetch(`${BASE}/api/hq/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superadminCookie },
    body: JSON.stringify({ title: "Genel Merkez Duyurusu", body: "Tüm şube müdürlerine önemli duyuru.", recipientTypes: ["MANAGERS"] }),
  });
  const hqSendBody = await hqSendRes.json();
  check(
    "POST hq/messages: 201 ve en az 2 şubeye ulaştı (Mezitli + Çankaya)",
    hqSendRes.status === 201 && hqSendBody.tenantsReached >= 2 && hqSendBody.recipientCount >= 2,
    hqSendBody,
  );

  // Not: Çankaya BRANCH_ADMIN'i (onur.kaya) için AYRI bir login YAPILMAZ —
  // dosyanın başında zaten "otherBranchAdminCookie" olarak giriş yapılmış
  // (tekrar login rate-limit'e (429) takılabiliyordu, aynı hesabı tekrar
  // giriş yapmadan yeniden kullanmak bu depodaki test script'lerinde
  // yaygın bir desen).
  const cankayaAdminInboxRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: otherBranchAdminCookie } });
  const cankayaAdminInboxBody = await cankayaAdminInboxRes.json();
  const cankayaHqEntry = cankayaAdminInboxBody.messages?.find((m) => m.title === "Genel Merkez Duyurusu");
  check("Çankaya şube müdürü HQ yayınını gelen kutusunda GÖRÜYOR (çapraz-tenant)", !!cankayaHqEntry, cankayaHqEntry);

  const branchAdminInboxRes = await fetch(`${BASE}/api/messages/inbox`, { headers: { Cookie: branchAdminCookie } });
  const branchAdminInboxBody = await branchAdminInboxRes.json();
  const mezitliHqEntry = branchAdminInboxBody.messages?.find((m) => m.title === "Genel Merkez Duyurusu");
  check("Mezitli şube müdürü de AYNI HQ yayınını görüyor", !!mezitliHqEntry, mezitliHqEntry);

  const hqSentListRes = await fetch(`${BASE}/api/hq/messages`, { headers: { Cookie: superadminCookie } });
  const hqSentListBody = await hqSentListRes.json();
  check(
    "GET hq/messages: gönderilenler listesinde İKİ ayrı satır var (her tenant için bir Message satırı)",
    hqSentListBody.messages?.filter((m) => m.title === "Genel Merkez Duyurusu").length >= 2,
    hqSentListBody.messages?.filter((m) => m.title === "Genel Merkez Duyurusu"),
  );

  // ===== Aktivite Akışı yansıması =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  check(
    "Aktivite Akışı: mesaj gönderimi kaydedildi",
    activityBody.entries?.some((e) => e.action === "Mesaj gönderildi" && e.detail?.includes("Veli Toplantısı Daveti")),
  );

  // Temizlik
  const hqMessageIds = (hqSentListBody.messages ?? []).filter((m) => m.title === "Genel Merkez Duyurusu").map((m) => m.id);
  const allTestMessageIds = [sentMessageId, otherSendBody.message.id, teacherSendBody.message.id, studentIdSendBody.message.id, ...hqMessageIds];
  await prisma.messageRecipient.deleteMany({ where: { messageId: { in: allTestMessageIds } } });
  await prisma.message.deleteMany({ where: { id: { in: allTestMessageIds } } });
  await prisma.auditLogEntry.deleteMany({ where: { action: { in: ["Mesaj gönderildi", "Mesaj geri çekildi", "Genel Merkez yayını alındı"] } } });

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
