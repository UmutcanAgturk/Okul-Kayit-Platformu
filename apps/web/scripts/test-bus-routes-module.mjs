// Servis / Ulaşım Takibi modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (bus
// routes migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET/POST /api/branch/bus-routes — yalnızca BRANCH_ADMIN oluşturabiliyor;
//      tenant izolasyonu.
//   2. GET /api/branch/bus-routes/:id + POST /api/branch/bus-routes/:id/members —
//      roster + toggle; bir öğrenciyi ikinci güzergaha eklemek onu birincisinden
//      OTOMATİK çıkarıyor (tek-güzergah kısıtı — Kulüpler'in aksine).
//   3. GET /api/students/:id/bus-route — STUDENT kendi, PARENT velisi olduğu
//      öğrencinin güzergahını görebiliyor; tenant izolasyonu; atanmamışsa
//      route: null dönüyor.
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
  if (!elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!branchAdminCookie && !!teacherCookie && !!studentCookie && !!parentCookie && !!otherStudentCookie && !!cankayaCookie,
  );

  // ===== 1) GET/POST /api/branch/bus-routes =====
  const noSessionPost = await fetch(`${BASE}/api/branch/bus-routes`, { method: "POST", body: JSON.stringify({}) });
  check("POST bus-routes: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const teacherPost = await fetch(`${BASE}/api/branch/bus-routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ name: "Kuzey Hattı" }),
  });
  check("Yetki: TEACHER rolü güzergah oluşturamıyor (403)", teacherPost.status === 403, teacherPost.status);

  const missingNamePost = await fetch(`${BASE}/api/branch/bus-routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({}),
  });
  check("POST bus-routes: eksik ad 400 dönüyor", missingNamePost.status === 400, missingNamePost.status);

  const createRouteARes = await fetch(`${BASE}/api/branch/bus-routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "Kuzey Hattı", driverName: "Mehmet Usta", driverPhone: "05551112233", capacity: 20, stops: ["Merkez", "Çamlık", "Okul"] }),
  });
  const routeABody = await createRouteARes.json();
  check("POST bus-routes: 201 dönüyor", createRouteARes.status === 201, createRouteARes.status);
  const routeAId = routeABody.route.id;

  const createRouteBRes = await fetch(`${BASE}/api/branch/bus-routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ name: "Güney Hattı", capacity: 15 }),
  });
  const routeBBody = await createRouteBRes.json();
  const routeBId = routeBBody.route.id;

  const listRes = await fetch(`${BASE}/api/branch/bus-routes`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("GET branch bus-routes: 200 dönüyor ve iki güzergah listede", listRes.status === 200 && listBody.routes?.length >= 2, listBody.routes?.length);

  const cankayaListRes = await fetch(`${BASE}/api/branch/bus-routes`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaListRes.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin güzergahlarını GÖREMİYOR",
    !cankayaListBody.routes?.some((r) => r.id === routeAId),
    cankayaListBody.routes?.length,
  );

  // ===== 2) GET detail + POST members (toggle + tek-güzergah kısıtı) =====
  const detailRes = await fetch(`${BASE}/api/branch/bus-routes/${routeAId}`, { headers: { Cookie: branchAdminCookie } });
  const detailBody = await detailRes.json();
  check("GET route detail: 200 dönüyor", detailRes.status === 200, detailRes.status);
  check("GET route detail: Elif rosterde ve üye değil", detailBody.roster?.some((s) => s.studentId === elif.id && !s.isMember));

  const addToARes = await fetch(`${BASE}/api/branch/bus-routes/${routeAId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  const addToABody = await addToARes.json();
  check("POST members: Elif Kuzey Hattı'na eklendi (isMember=true)", addToARes.status === 200 && addToABody.isMember === true, addToABody.isMember);

  const addToBRes = await fetch(`${BASE}/api/branch/bus-routes/${routeBId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  const addToBBody = await addToBRes.json();
  check("POST members: Elif Güney Hattı'na eklendi (isMember=true)", addToBRes.status === 200 && addToBBody.isMember === true, addToBBody.isMember);

  const routeADetailAfter = await fetch(`${BASE}/api/branch/bus-routes/${routeAId}`, { headers: { Cookie: branchAdminCookie } });
  const routeADetailAfterBody = await routeADetailAfter.json();
  check(
    "Tek-güzergah kısıtı: Elif Güney'e eklenince Kuzey'den OTOMATİK çıkarıldı",
    !routeADetailAfterBody.roster?.find((s) => s.studentId === elif.id)?.isMember,
  );

  const removeFromBRes = await fetch(`${BASE}/api/branch/bus-routes/${routeBId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });
  const removeFromBBody = await removeFromBRes.json();
  check("POST members: tekrar çağrı Güney'den çıkarıyor (isMember=false)", removeFromBRes.status === 200 && removeFromBBody.isMember === false, removeFromBBody.isMember);

  // ===== 3) GET /api/students/:id/bus-route =====
  const noSessionStudentGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`);
  check("GET student bus-route: oturum yoksa 401 dönüyor", noSessionStudentGet.status === 401, noSessionStudentGet.status);

  const unassignedGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`, { headers: { Cookie: studentCookie } });
  const unassignedBody = await unassignedGet.json();
  check("GET student bus-route: atanmamışken route:null dönüyor", unassignedGet.status === 200 && unassignedBody.route === null, unassignedBody.route);

  await fetch(`${BASE}/api/branch/bus-routes/${routeAId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ studentId: elif.id }),
  });

  const ownGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`, { headers: { Cookie: studentCookie } });
  const ownGetBody = await ownGet.json();
  check("GET student bus-route: STUDENT kendi güzergahını görebiliyor", ownGet.status === 200 && ownGetBody.route?.id === routeAId, ownGetBody.route?.name);

  const otherStudentGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in güzergahını GÖREMİYOR (403)", otherStudentGet.status === 403, otherStudentGet.status);

  const parentGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`, { headers: { Cookie: parentCookie } });
  check("GET student bus-route: velisi PARENT görebiliyor (200)", parentGet.status === 200, parentGet.status);

  const cankayaStudentGet = await fetch(`${BASE}/api/students/${elif.id}/bus-route`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaStudentGet.status === 404,
    cankayaStudentGet.status,
  );

  // Temizlik
  await prisma.studentProfile.update({ where: { id: elif.id }, data: { busRouteId: null } });
  await prisma.busRoute.delete({ where: { id: routeAId } });
  await prisma.busRoute.delete({ where: { id: routeBId } });
  await prisma.auditLogEntry.deleteMany({ where: { action: "Servis güzergahı oluşturuldu" } });

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
