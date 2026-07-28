// "Bugün" Özet Ekranı'nın GERÇEK bir Postgres veritabanına karşı uçtan uca
// doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı. Yeni bir Prisma modeli/migration
// EKLEMEZ — Devamsızlık, Ödeme, Veli Görüşmesi ve Aktivite Akışı modüllerinin
// gerçek verisini birleştirir (bkz. app/api/branch/today-summary route'undaki not).
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN erişebiliyor (TEACHER 403, oturumsuz 401).
//   2. Bugün için bir yoklama kaydı eklemenin classroomsTakenToday'i artırdığı.
//   3. Vadesi geçmiş bir taksitin overdueCount'a, yaklaşan bir taksitin
//      upcomingCount'a yansıdığı.
//   4. Bugüne ait BEKLIYOR bir PtaMeetingRequest'in hem pta.today listesinde
//      hem pendingCount'ta göründüğü.
//   5. Bir disiplin kaydı eklemenin recentActivity'nin en başında göründüğü.
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

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchAdminCookie && !!teacherCookie);

  const noSessionRes = await fetch(`${BASE}/api/branch/today-summary`);
  check("GET today-summary: oturum yoksa 401 dönüyor", noSessionRes.status === 401, noSessionRes.status);

  const teacherRes = await fetch(`${BASE}/api/branch/today-summary`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü Bugün özetini göremiyor (403)", teacherRes.status === 403, teacherRes.status);

  const beforeRes = await fetch(`${BASE}/api/branch/today-summary`, { headers: { Cookie: branchAdminCookie } });
  const beforeBody = await beforeRes.json();
  check("GET today-summary: BRANCH_ADMIN 200 dönüyor", beforeRes.status === 200, beforeRes.status);
  const takenBefore = beforeBody.attendance?.classroomsTakenToday ?? 0;
  const overdueBefore = beforeBody.payments?.overdueCount ?? 0;
  const upcomingBefore = beforeBody.payments?.upcomingCount ?? 0;
  const pendingPtaBefore = beforeBody.pta?.pendingCount ?? 0;

  // ===== Fixture: bugün için yoklama =====
  const today = new Date().toISOString().slice(0, 10);
  const attendanceRes = await fetch(`${BASE}/api/branch/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ classroomId: elif.classroomId, date: today, records: [{ studentId: elif.id, status: "VAR" }] }),
  });
  check("POST attendance: fixture 200 dönüyor", attendanceRes.status === 200, attendanceRes.status);

  // ===== Fixture: vadesi geçmiş + yaklaşan taksit =====
  const overdueInstallment = await prisma.paymentInstallment.create({
    data: {
      tenantId: elif.tenantId,
      studentId: elif.id,
      installmentNo: 9901,
      amount: 100,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: "PENDING",
    },
  });
  const upcomingInstallment = await prisma.paymentInstallment.create({
    data: {
      tenantId: elif.tenantId,
      studentId: elif.id,
      installmentNo: 9902,
      amount: 100,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "PENDING",
    },
  });

  // ===== Fixture: bugüne ait bekleyen PTA talebi =====
  const ptaRes = await fetch(`${BASE}/api/students/${elif.id}/pta-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: (await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD)) },
    body: JSON.stringify({ teacherId: ayseTeacher.id, requestedAt: new Date().toISOString(), topic: "Bugün özeti testi" }),
  });
  const ptaBody = await ptaRes.json();
  check("POST pta-requests: fixture 201 dönüyor", ptaRes.status === 201, ptaRes.status);

  // ===== Fixture: disiplin kaydı (Aktivite Akışı'na yansımalı) =====
  const disciplineRes = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMLU", category: "Derse Katılım", note: "Bugün özeti testi" }),
  });
  const disciplineBody = await disciplineRes.json();
  check("POST discipline: fixture 201 dönüyor", disciplineRes.status === 201, disciplineRes.status);

  // ===== Doğrulama =====
  const afterRes = await fetch(`${BASE}/api/branch/today-summary`, { headers: { Cookie: branchAdminCookie } });
  const afterBody = await afterRes.json();
  check("GET today-summary: 200 dönüyor (fixture sonrası)", afterRes.status === 200, afterRes.status);
  check(
    "attendance.classroomsTakenToday 1 arttı",
    afterBody.attendance?.classroomsTakenToday === takenBefore + 1,
    afterBody.attendance?.classroomsTakenToday,
  );
  check("payments.overdueCount 1 arttı", afterBody.payments?.overdueCount === overdueBefore + 1, afterBody.payments?.overdueCount);
  check("payments.upcomingCount 1 arttı", afterBody.payments?.upcomingCount === upcomingBefore + 1, afterBody.payments?.upcomingCount);
  check("pta.pendingCount 1 arttı", afterBody.pta?.pendingCount === pendingPtaBefore + 1, afterBody.pta?.pendingCount);
  check(
    "pta.today: yeni talep bugünkü listede",
    afterBody.pta?.today?.some((r) => r.id === ptaBody.request.id),
  );
  check(
    "recentActivity: en yeni kayıt disiplin kaydı",
    afterBody.recentActivity?.[0]?.action === "Disiplin kaydı eklendi",
    afterBody.recentActivity?.[0]?.action,
  );

  // Temizlik
  await prisma.paymentInstallment.delete({ where: { id: overdueInstallment.id } });
  await prisma.paymentInstallment.delete({ where: { id: upcomingInstallment.id } });
  await prisma.ptaMeetingRequest.delete({ where: { id: ptaBody.request.id } });
  await prisma.disciplineRecord.delete({ where: { id: disciplineBody.record.id } });
  await prisma.attendanceRecord.deleteMany({ where: { studentId: elif.id, date: new Date(`${today}T00:00:00.000Z`) } });
  await prisma.auditLogEntry.deleteMany({ where: { action: { in: ["Disiplin kaydı eklendi", "Veli görüşmesi talep edildi"] } } });

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
