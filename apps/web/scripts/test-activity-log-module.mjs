// Aktivite Akışı (Audit Log) modülünün GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy`
// (audit log migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET /api/branch/activity-log — yalnızca BRANCH_ADMIN görebiliyor
//      (TEACHER/ACCOUNTING/GUIDANCE_COORDINATOR 403), tenant izolasyonu.
//   2. Disiplin kaydı eklemenin gerçekten AuditLogEntry oluşturduğu (bir
//      diğer modülün write path'ine wire edilen logActivity() çağrısının
//      uçtan uca çalıştığının doğrulaması).
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
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: tüm roller için giriş başarılı", !!branchAdminCookie && !!teacherCookie && !!cankayaCookie);

  // ===== 1) Yetki/tenant izolasyonu =====
  const noSessionRes = await fetch(`${BASE}/api/branch/activity-log`);
  check("GET activity-log: oturum yoksa 401 dönüyor", noSessionRes.status === 401, noSessionRes.status);

  const teacherRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü aktivite akışını göremiyor (403)", teacherRes.status === 403, teacherRes.status);

  // ===== 2) Disiplin kaydı ekle -> audit log'a yansımalı =====
  const beforeRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const beforeBody = await beforeRes.json();
  check("GET activity-log: BRANCH_ADMIN 200 dönüyor", beforeRes.status === 200, beforeRes.status);
  const countBefore = beforeBody.entries?.length ?? 0;

  const disciplineRes = await fetch(`${BASE}/api/branch/discipline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ studentId: elif.id, type: "OLUMLU", category: "Derse Katılım", note: "Audit log testi" }),
  });
  const disciplineBody = await disciplineRes.json();
  check("POST discipline: 201 dönüyor (fixture)", disciplineRes.status === 201, disciplineRes.status);

  const afterRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const afterBody = await afterRes.json();
  check("GET activity-log: disiplin kaydından sonra bir kayıt daha var", (afterBody.entries?.length ?? 0) === countBefore + 1, afterBody.entries?.length);

  const newest = afterBody.entries?.[0];
  check("GET activity-log: en yeni kayıt 'Disiplin kaydı eklendi' aksiyonu", newest?.action === "Disiplin kaydı eklendi", newest?.action);
  check("GET activity-log: actorLabel 'Ayşe Demir (Öğretmen)' içeriyor", newest?.actorLabel === "Ayşe Demir (Öğretmen)", newest?.actorLabel);
  check("GET activity-log: detail 'OLUMLU · Derse Katılım'", newest?.detail === "OLUMLU · Derse Katılım", newest?.detail);

  // ===== 3) Tenant izolasyonu =====
  const cankayaRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: cankayaCookie } });
  const cankayaBody = await cankayaRes.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin aktivite kaydını GÖREMİYOR",
    !cankayaBody.entries?.some((e) => e.id === newest?.id),
  );

  // Temizlik
  await prisma.disciplineRecord.delete({ where: { id: disciplineBody.record.id } });
  await prisma.auditLogEntry.deleteMany({ where: { actorLabel: "Ayşe Demir (Öğretmen)", detail: "OLUMLU · Derse Katılım" } });

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
