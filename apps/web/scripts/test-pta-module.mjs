// Veli-Öğretmen Görüşme Randevusu modülünün GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (PTA
// migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. POST /api/students/:id/pta-requests — yalnızca PARENT, yalnızca kendi
//      velisi olduğu öğrenci için, geçerli teacherId/requestedAt ile talep
//      oluşturabiliyor.
//   2. GET /api/students/:id/pta-requests — STUDENT kendi, PARENT velisi
//      olduğu öğrencinin taleplerini görebiliyor; tenant izolasyonu.
//   3. GET/POST /api/teacher/pta-requests[/:id/respond] — öğretmen yalnızca
//      KENDİSİNE atanmış talepleri görüyor/yanıtlıyor; çift yanıt 409;
//      başka bir öğretmenin talebine erişim 404.
//   4. GET /api/branch/pta-requests — şube yöneticisi tüm tenant'ı görebiliyor,
//      öğretmen bu uç noktaya erişemiyor, tenant izolasyonu.
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
  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const ahmet = await prisma.studentProfile.findFirst({ where: { user: { email: "ahmet.yilmaz@ogrenci.seviye360.com" } } });
  const ayseTeacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  if (!elif || !ahmet || !ayseTeacher) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  // İkinci bir öğretmen (Mezitli tenant'ında) — çapraz-öğretmen izolasyonunu
  // test etmek için ham Prisma ile oluşturulur (seed'de yalnızca 1 öğretmen var).
  const secondTeacherUser = await prisma.user.create({
    data: {
      tenantId: elif.tenantId,
      email: `test-second-teacher-${Date.now()}@seviye360.com`,
      passwordHash: "not-a-real-hash",
      role: "TEACHER",
      firstName: "İkinci",
      lastName: "Öğretmen",
    },
  });
  const secondTeacher = await prisma.teacherProfile.create({
    data: { userId: secondTeacherUser.id, branch: "Kimya" },
  });

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!teacherCookie && !!branchAdminCookie && !!studentCookie && !!otherStudentCookie && !!parentCookie && !!cankayaCookie,
  );

  const requestedAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // ===== 1) POST /api/students/:id/pta-requests — yetki/doğrulama =====
  const noSessionPost = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, { method: "POST", body: JSON.stringify({}) });
  check("POST pta-requests: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const studentPost = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ teacherId: ayseTeacher.id, requestedAt }),
  });
  check("Yetki: STUDENT rolü görüşme talebi oluşturamıyor (403)", studentPost.status === 403, studentPost.status);

  const missingFieldsPost = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({}),
  });
  check("POST pta-requests: eksik alan 400 dönüyor", missingFieldsPost.status === 400, missingFieldsPost.status);

  const wrongChildPost = await fetch(`${BASE}/api/students/${ahmet.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ teacherId: ayseTeacher.id, requestedAt }),
  });
  check("Yetki: PARENT velisi olmadığı öğrenci için talep oluşturamıyor (403)", wrongChildPost.status === 403, wrongChildPost.status);

  const missingTeacherPost = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ teacherId: "does-not-exist", requestedAt }),
  });
  check("POST pta-requests: olmayan öğretmen için 404 dönüyor", missingTeacherPost.status === 404, missingTeacherPost.status);

  // ===== 2) POST — başarılı oluşturma =====
  const createRes = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ teacherId: ayseTeacher.id, requestedAt, topic: "Sınav performansı" }),
  });
  const createBody = await createRes.json();
  check("POST pta-requests: 201 dönüyor", createRes.status === 201, createRes.status);
  check("Oluşturulan kayıt: durum BEKLIYOR", createBody.request?.status === "BEKLIYOR", createBody.request?.status);

  // İkinci öğretmene yöneltilen bir talep — çapraz-öğretmen izolasyon testi için.
  const otherTeacherRequest = await prisma.ptaMeetingRequest.create({
    data: {
      tenantId: elif.tenantId,
      studentId: elif.id,
      teacherId: secondTeacher.id,
      requestedAt: new Date(requestedAt),
      status: "BEKLIYOR",
      requestedByUserId: createBody.request.requestedByUserId,
    },
  });

  // ===== 3) GET /api/students/:id/pta-requests =====
  const noSessionGet = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`);
  check("GET student pta-requests: oturum yoksa 401 dönüyor", noSessionGet.status === 401, noSessionGet.status);

  const ownGet = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, { headers: { Cookie: studentCookie } });
  const ownGetBody = await ownGet.json();
  check("GET student pta-requests: STUDENT kendi kaydını görebiliyor (200)", ownGet.status === 200, ownGet.status);
  check("GET student pta-requests: iki talep de listede", ownGetBody.requests?.length === 2, ownGetBody.requests?.length);

  const otherStudentGet = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in taleplerini GÖREMİYOR (403)", otherStudentGet.status === 403, otherStudentGet.status);

  const parentGet = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, { headers: { Cookie: parentCookie } });
  check("GET student pta-requests: velisi PARENT görebiliyor (200)", parentGet.status === 200, parentGet.status);

  const cankayaStudentGet = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaStudentGet.status === 404,
    cankayaStudentGet.status,
  );

  // ===== 4) GET/POST /api/teacher/pta-requests =====
  const teacherInboxRes = await fetch(`${BASE}/api/teacher/pta-requests`, { headers: { Cookie: teacherCookie } });
  const teacherInboxBody = await teacherInboxRes.json();
  check("GET teacher inbox: 200 dönüyor", teacherInboxRes.status === 200, teacherInboxRes.status);
  check(
    "Çapraz-öğretmen izolasyonu: Ayşe yalnızca KENDİSİNE atanan talebi görüyor",
    teacherInboxBody.requests?.length === 1 && teacherInboxBody.requests[0].id === createBody.request.id,
    teacherInboxBody.requests?.length,
  );

  const branchTeacherRes = await fetch(`${BASE}/api/branch/pta-requests`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER /api/branch/pta-requests'e erişemiyor (403)", branchTeacherRes.status === 403, branchTeacherRes.status);

  const invalidDecisionRes = await fetch(`${BASE}/api/teacher/pta-requests/${createBody.request.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "MAYBE" }),
  });
  check("POST respond: geçersiz decision 400 dönüyor", invalidDecisionRes.status === 400, invalidDecisionRes.status);

  const crossTeacherRespondRes = await fetch(`${BASE}/api/teacher/pta-requests/${otherTeacherRequest.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check(
    "Çapraz-öğretmen izolasyonu: Ayşe başka öğretmenin talebini yanıtlayamıyor (404)",
    crossTeacherRespondRes.status === 404,
    crossTeacherRespondRes.status,
  );

  const approveRes = await fetch(`${BASE}/api/teacher/pta-requests/${createBody.request.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  const approveBody = await approveRes.json();
  check("POST respond: onaylama 200 dönüyor", approveRes.status === 200, approveRes.status);
  check("POST respond: durum ONAYLANDI", approveBody.request?.status === "ONAYLANDI", approveBody.request?.status);

  const doubleRespondRes = await fetch(`${BASE}/api/teacher/pta-requests/${createBody.request.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "REJECT" }),
  });
  check("POST respond: zaten yanıtlanmış talep 409 dönüyor", doubleRespondRes.status === 409, doubleRespondRes.status);

  // ===== 5) GET /api/branch/pta-requests =====
  const branchListRes = await fetch(`${BASE}/api/branch/pta-requests`, { headers: { Cookie: branchAdminCookie } });
  const branchListBody = await branchListRes.json();
  check("GET branch pta-requests: 200 dönüyor ve iki talep de listede", branchListRes.status === 200 && branchListBody.requests?.length >= 2, branchListBody.requests?.length);

  const cankayaBranchListRes = await fetch(`${BASE}/api/branch/pta-requests`, { headers: { Cookie: cankayaCookie } });
  const cankayaBranchListBody = await cankayaBranchListRes.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin taleplerini GÖREMİYOR",
    cankayaBranchListBody.requests?.length === 0,
    cankayaBranchListBody.requests?.length,
  );

  // Temizlik
  await prisma.ptaMeetingRequest.delete({ where: { id: createBody.request.id } });
  await prisma.ptaMeetingRequest.delete({ where: { id: otherTeacherRequest.id } });
  await prisma.teacherProfile.delete({ where: { id: secondTeacher.id } });
  await prisma.user.delete({ where: { id: secondTeacherUser.id } });
  // Bu testin tetiklediği Aktivite Akışı (Audit Log) yan etkilerini de temizle
  // (bkz. app/api/students/[studentId]/pta-requests ve .../respond route'larındaki logActivity çağrıları).
  await prisma.auditLogEntry.deleteMany({
    where: { action: { in: ["Veli görüşmesi talep edildi", "Veli görüşmesi onaylandı", "Veli görüşmesi reddedildi"] } },
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
