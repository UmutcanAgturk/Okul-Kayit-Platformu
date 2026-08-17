// Personel Devam Durumu modülünün (app/api/branch/staff-attendance) GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER/STUDENT 403, oturumsuz 401), tenant
// izolasyonu (başka şubenin personeline erişilemez), demo ile BİREBİR aynı
// "yalnızca istisna" deseni (GELDI hiç satır olarak saklanmaz — Gelmedi/İzinli
// işaretlenince kayıt oluşur, Geldi'ye geri dönünce kayıt SİLİNİR), ve
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
  const ayse = await prisma.user.findFirst({ where: { email: "ayse.demir@seviye360.com" } });
  if (!ayse) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!studentCookie && !!cankayaCookie);

  const base = `${BASE}/api/branch/staff-attendance`;

  const noSession = await fetch(base);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherRes = await fetch(base, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER göremez (403)", teacherRes.status === 403, teacherRes.status);

  const studentRes = await fetch(base, { headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT göremez (403)", studentRes.status === 403, studentRes.status);

  const beforeRes = await fetch(base, { headers: { Cookie: branchCookie } });
  const beforeBody = await beforeRes.json();
  check("GET: 200 ve staff dizisi mevcut", beforeRes.status === 200 && Array.isArray(beforeBody.staff), beforeBody.date);

  const ayseRowBefore = beforeBody.staff.find((s) => s.userId === ayse.id);
  check("GET: Ayşe Demir roster'da ve varsayılan durumu GELDI (istisna yoksa)", ayseRowBefore?.status === "GELDI", ayseRowBefore);

  const dbBefore = await prisma.staffAttendanceRecord.findUnique({ where: { userId_date: { userId: ayse.id, date: new Date(`${beforeBody.date}T00:00:00.000Z`) } } });
  check("DB: GELDI durumunda hiç satır YOK (yalnızca istisna deseni)", dbBefore === null, dbBefore);

  const postNoAuthRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: ayse.id, status: "GELMEDI" }),
  });
  check("POST: oturumsuz 401", postNoAuthRes.status === 401, postNoAuthRes.status);

  const postTeacherRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ userId: ayse.id, status: "GELMEDI" }),
  });
  check("Yetki: TEACHER işaretleyemez (403)", postTeacherRes.status === 403, postTeacherRes.status);

  const badStatusRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ userId: ayse.id, status: "TATIL" }),
  });
  check("POST: geçersiz status 400", badStatusRes.status === 400, badStatusRes.status);

  const missingUserRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ status: "GELMEDI" }),
  });
  check("POST: userId eksik 400", missingUserRes.status === 400, missingUserRes.status);

  const unknownUserRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ userId: "does-not-exist", status: "GELMEDI" }),
  });
  check("POST: olmayan kullanıcı 404", unknownUserRes.status === 404, unknownUserRes.status);

  const cankayaPostRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ userId: ayse.id, status: "GELMEDI" }),
  });
  check("Tenant izolasyonu: Çankaya yöneticisi Mezitli öğretmenini işaretleyemez (404)", cankayaPostRes.status === 404, cankayaPostRes.status);

  const setGelmediRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ userId: ayse.id, status: "GELMEDI" }),
  });
  const setGelmediBody = await setGelmediRes.json();
  check("POST: GELMEDI işaretlendi (200)", setGelmediRes.status === 200 && setGelmediBody.status === "GELMEDI", setGelmediBody);

  const dbAfterGelmedi = await prisma.staffAttendanceRecord.findUnique({ where: { userId_date: { userId: ayse.id, date: new Date(`${setGelmediBody.date}T00:00:00.000Z`) } } });
  check("DB: GELMEDI satırı gerçekten oluştu", dbAfterGelmedi?.status === "GELMEDI", dbAfterGelmedi?.status);

  const afterGelmediRes = await fetch(base, { headers: { Cookie: branchCookie } });
  const afterGelmediBody = await afterGelmediRes.json();
  const ayseRowAfter = afterGelmediBody.staff.find((s) => s.userId === ayse.id);
  check("GET: Ayşe Demir artık GELMEDI olarak görünüyor", ayseRowAfter?.status === "GELMEDI", ayseRowAfter);
  check(
    "GET: presentCount bir azaldı",
    afterGelmediBody.presentCount === beforeBody.presentCount - 1,
    { before: beforeBody.presentCount, after: afterGelmediBody.presentCount },
  );

  const editLog = await prisma.auditLogEntry.findFirst({
    where: { tenantId: ayse.tenantId, action: "Personel devam durumu güncellendi", detail: { contains: "Gelmedi" } },
    orderBy: { createdAt: "desc" },
  });
  check("Aktivite Akışı: Gelmedi işaretleme loglandı", !!editLog, editLog?.detail);

  // Demo ile birebir aynı "yalnızca istisna" deseni: GELDI'ye dönünce satır SİLİNİR.
  const setGeldiRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ userId: ayse.id, status: "GELDI" }),
  });
  check("POST: GELDI'ye geri dönüldü (200)", setGeldiRes.status === 200, setGeldiRes.status);

  const dbAfterGeldi = await prisma.staffAttendanceRecord.findUnique({ where: { userId_date: { userId: ayse.id, date: new Date(`${beforeBody.date}T00:00:00.000Z`) } } });
  check("DB: GELDI'ye dönünce satır SİLİNDİ (demo'daki delete map[staffId] deseni)", dbAfterGeldi === null, dbAfterGeldi);

  const afterGeldiRes = await fetch(base, { headers: { Cookie: branchCookie } });
  const afterGeldiBody = await afterGeldiRes.json();
  check(
    "GET: presentCount başlangıç değerine geri döndü",
    afterGeldiBody.presentCount === beforeBody.presentCount,
    { before: beforeBody.presentCount, after: afterGeldiBody.presentCount },
  );

  // ===== Temizlik =====
  await prisma.staffAttendanceRecord.deleteMany({ where: { userId: ayse.id } });
  await prisma.auditLogEntry.deleteMany({ where: { action: "Personel devam durumu güncellendi", detail: { contains: "Ayşe Demir" } } });

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
