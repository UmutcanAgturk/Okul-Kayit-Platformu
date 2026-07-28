// Kulüpler / Sosyal Etkinlikler modülünün GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy`
// (clubs migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET/POST /api/branch/clubs — yalnızca BRANCH_ADMIN oluşturabiliyor;
//      tenant izolasyonu.
//   2. GET /api/branch/clubs/:id + POST /api/branch/clubs/:id/members —
//      BRANCH_ADMIN her kulübü, TEACHER yalnızca kendi danışmanı olduğu
//      kulübü yönetebiliyor (başka kulübe erişim 403); toggle ekleme/çıkarma.
//   3. GET /api/teacher/clubs — öğretmen yalnızca danışmanı olduğu kulüpleri
//      görüyor.
//   4. GET /api/clubs + POST /api/clubs/:id/membership — öğrenci tüm
//      kulüpleri görüp kendi üyeliğini açıp/kapatabiliyor.
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
  const ayseTeacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  if (!elif || !ayseTeacher) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  // İkinci bir öğretmen — çapraz-danışman izolasyonunu test etmek için ham
  // Prisma ile oluşturulur (seed'de yalnızca 1 öğretmen var).
  const otherTeacherUser = await prisma.user.create({
    data: {
      tenantId: elif.tenantId,
      email: `test-second-teacher-clubs-${Date.now()}@seviye360.com`,
      passwordHash: "not-a-real-hash",
      role: "TEACHER",
      firstName: "Diğer",
      lastName: "Öğretmen",
    },
  });
  const otherTeacher = await prisma.teacherProfile.create({ data: { userId: otherTeacherUser.id, branch: "Biyoloji" } });

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!branchAdminCookie && !!teacherCookie && !!studentCookie && !!cankayaCookie,
  );

  // ===== 1) GET/POST /api/branch/clubs =====
  const noSessionPost = await fetch(`${BASE}/api/branch/clubs`, { method: "POST", body: JSON.stringify({}) });
  check("POST clubs: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const teacherPost = await fetch(`${BASE}/api/branch/clubs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ name: "Satranç Kulübü" }),
  });
  check("Yetki: TEACHER rolü kulüp oluşturamıyor (403)", teacherPost.status === 403, teacherPost.status);

  const missingNamePost = await fetch(`${BASE}/api/branch/clubs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({}),
  });
  check("POST clubs: eksik ad 400 dönüyor", missingNamePost.status === 400, missingNamePost.status);

  const createRes = await fetch(`${BASE}/api/branch/clubs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "Satranç Kulübü", description: "Haftalık satranç turnuvaları", advisorTeacherId: ayseTeacher.id }),
  });
  const createBody = await createRes.json();
  check("POST clubs: 201 dönüyor", createRes.status === 201, createRes.status);
  const clubId = createBody.club.id;

  const listRes = await fetch(`${BASE}/api/branch/clubs`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET branch clubs: 200 dönüyor ve kulüp listede", listRes.status === 200 && listBody.clubs?.some((c) => c.id === clubId), listBody.clubs?.length);

  const cankayaListRes = await fetch(`${BASE}/api/branch/clubs`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaListRes.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin kulübünü GÖREMİYOR",
    !cankayaListBody.clubs?.some((c) => c.id === clubId),
    cankayaListBody.clubs?.length,
  );

  // ===== 2) GET /api/branch/clubs/:id + POST members (toggle) =====
  const detailRes = await fetch(`${BASE}/api/branch/clubs/${clubId}`, { headers: { Cookie: branchAdminCookie } });
  const detailBody = await detailRes.json();
  check("GET club detail: BRANCH_ADMIN 200 dönüyor", detailRes.status === 200, detailRes.status);
  check("GET club detail: Elif rosterde ve üye değil", detailBody.roster?.some((s) => s.studentId === elif.id && !s.isMember));

  const teacherDetailRes = await fetch(`${BASE}/api/branch/clubs/${clubId}`, { headers: { Cookie: teacherCookie } });
  check("GET club detail: danışman TEACHER (Ayşe) 200 dönüyor", teacherDetailRes.status === 200, teacherDetailRes.status);

  const toggleAddRes = await fetch(`${BASE}/api/branch/clubs/${clubId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  const toggleAddBody = await toggleAddRes.json();
  check("POST members: danışman öğrenci ekleyebiliyor (200, isMember=true)", toggleAddRes.status === 200 && toggleAddBody.isMember === true, toggleAddBody.isMember);

  const toggleRemoveRes = await fetch(`${BASE}/api/branch/clubs/${clubId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  const toggleRemoveBody = await toggleRemoveRes.json();
  check("POST members: tekrar çağrı çıkarıyor (200, isMember=false)", toggleRemoveRes.status === 200 && toggleRemoveBody.isMember === false, toggleRemoveBody.isMember);

  // Çapraz-danışman izolasyonu: bu kulübün danışmanı Ayşe, otherTeacher değil.
  // Ham prisma ile ikinci bir kulüp oluşturup otherTeacher'a atarız, sonra
  // Ayşe'nin ona erişemediğini doğrularız.
  const otherClub = await prisma.club.create({
    data: { tenantId: elif.tenantId, name: "Robotik Kulübü", advisorTeacherId: otherTeacher.id },
  });
  const crossAdvisorDetailRes = await fetch(`${BASE}/api/branch/clubs/${otherClub.id}`, { headers: { Cookie: teacherCookie } });
  check(
    "Çapraz-danışman izolasyonu: Ayşe başka öğretmenin kulübünü GÖREMİYOR (403)",
    crossAdvisorDetailRes.status === 403,
    crossAdvisorDetailRes.status,
  );
  const crossAdvisorToggleRes = await fetch(`${BASE}/api/branch/clubs/${otherClub.id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  check(
    "Çapraz-danışman izolasyonu: Ayşe başka öğretmenin kulübüne üye ekleyemiyor (403)",
    crossAdvisorToggleRes.status === 403,
    crossAdvisorToggleRes.status,
  );

  // ===== 3) GET /api/teacher/clubs =====
  const teacherClubsRes = await fetch(`${BASE}/api/teacher/clubs`, { headers: { Cookie: teacherCookie } });
  const teacherClubsBody = await teacherClubsRes.json();
  check(
    "GET teacher clubs: yalnızca kendi danışmanı olduğu kulüp listede",
    teacherClubsRes.status === 200 && teacherClubsBody.clubs?.length === 1 && teacherClubsBody.clubs[0].id === clubId,
    teacherClubsBody.clubs?.length,
  );

  // ===== 4) GET /api/clubs + POST /api/clubs/:id/membership =====
  const noSessionStudentGet = await fetch(`${BASE}/api/clubs`);
  check("GET student clubs: oturum yoksa 401 dönüyor", noSessionStudentGet.status === 401, noSessionStudentGet.status);

  const branchAdminStudentGet = await fetch(`${BASE}/api/clubs`, { headers: { Cookie: branchAdminCookie } });
  check("Yetki: BRANCH_ADMIN /api/clubs'a erişemiyor (403)", branchAdminStudentGet.status === 403, branchAdminStudentGet.status);

  const studentClubsRes = await fetch(`${BASE}/api/clubs`, { headers: { Cookie: studentCookie } });
  const studentClubsBody = await studentClubsRes.json();
  check(
    "GET student clubs: 200 dönüyor, Satranç Kulübü üye değil olarak listede",
    studentClubsRes.status === 200 && studentClubsBody.clubs?.some((c) => c.id === clubId && c.isMember === false),
  );

  const joinRes = await fetch(`${BASE}/api/clubs/${clubId}/membership`, { method: "POST", headers: { Cookie: studentCookie } });
  const joinBody = await joinRes.json();
  check("POST membership: öğrenci katılabiliyor (200, isMember=true)", joinRes.status === 200 && joinBody.isMember === true, joinBody.isMember);

  const afterJoinGet = await fetch(`${BASE}/api/clubs`, { headers: { Cookie: studentCookie } });
  const afterJoinBody = await afterJoinGet.json();
  check(
    "GET student clubs: katıldıktan sonra isMember=true ve memberCount=1",
    afterJoinBody.clubs?.find((c) => c.id === clubId)?.isMember === true && afterJoinBody.clubs?.find((c) => c.id === clubId)?.memberCount === 1,
  );

  const leaveRes = await fetch(`${BASE}/api/clubs/${clubId}/membership`, { method: "POST", headers: { Cookie: studentCookie } });
  const leaveBody = await leaveRes.json();
  check("POST membership: öğrenci ayrılabiliyor (200, isMember=false)", leaveRes.status === 200 && leaveBody.isMember === false, leaveBody.isMember);

  // Temizlik
  await prisma.club.delete({ where: { id: otherClub.id } });
  await prisma.club.delete({ where: { id: clubId } });
  await prisma.teacherProfile.delete({ where: { id: otherTeacher.id } });
  await prisma.user.delete({ where: { id: otherTeacherUser.id } });
  // Bu testin tetiklediği Aktivite Akışı (Audit Log) yan etkisini de temizle
  // (bkz. app/api/branch/clubs route'undaki logActivity çağrısı).
  await prisma.auditLogEntry.deleteMany({ where: { action: "Kulüp oluşturuldu", detail: "Satranç Kulübü" } });

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
