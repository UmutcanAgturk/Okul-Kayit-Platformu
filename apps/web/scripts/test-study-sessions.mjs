// Etüt (StudySession) onay/red API'sinin GERÇEK bir Postgres'e karşı uçtan
// uca doğrulaması — taksit tahsilatındaki deseni (gerçek DB + RLS + oturum
// tabanlı kimlik) ikinci bir alana tekrarlar. Önkoşullar: migration + kökten
// `npm run seed` uygulanmış, `npm run dev` çalışıyor olmalı.
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
  const teacherUser = await prisma.user.findUnique({ where: { email: "ayse.demir@seviye360.com" } });
  if (!teacherUser) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Login: öğretmen girişi başarılı", !!teacherCookie);

  // ===== 1) Oturum olmadan liste/yanıt erişimi engellenmeli =====
  const noSessionList = await fetch(`${BASE}/api/teacher/study-sessions`);
  check("GET study-sessions: oturum yoksa 401 dönüyor", noSessionList.status === 401, noSessionList.status);

  // ===== 2) Öğretmen kendi AI_SUGGESTED seansını listeler =====
  const listRes = await fetch(`${BASE}/api/teacher/study-sessions`, { headers: { Cookie: teacherCookie } });
  const listBody = await listRes.json();
  check("GET study-sessions: 200 dönüyor", listRes.status === 200, listRes.status);
  const suggested = listBody.sessions?.find((s) => s.status === "AI_SUGGESTED");
  check("GET study-sessions: en az bir AI_SUGGESTED seans var", !!suggested, listBody.sessions?.map((s) => s.status));
  if (!suggested) {
    console.log("AI_SUGGESTED seans bulunamadı, kalan testler atlanıyor.");
    return finish();
  }

  // ===== 3) Öğrenci rolü yanıt veremez (403) =====
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const asStudent = await fetch(`${BASE}/api/teacher/study-sessions/${suggested.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Yetki: STUDENT rolü etüt seansına yanıt veremiyor (403)", asStudent.status === 403, asStudent.status);

  // ===== 4) Tenant izolasyonu: Çankaya yöneticisi bu seansı göremez/yanıtlayamaz (404) =====
  // (Çankaya yöneticisi TEACHER değil BRANCH_ADMIN olduğu için zaten 403 almalı,
  // ama asıl önemli olan RLS'in seansı tenant dışına hiç sızdırmaması.)
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const asCankaya = await fetch(`${BASE}/api/teacher/study-sessions/${suggested.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Yetki/tenant: Çankaya yöneticisi (farklı tenant + yanlış rol) yanıtlayamıyor", asCankaya.status === 403 || asCankaya.status === 404, asCankaya.status);

  // ===== 5) Girdi doğrulama =====
  const badDecision = await fetch(`${BASE}/api/teacher/study-sessions/${suggested.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "MAYBE" }),
  });
  check("POST respond: geçersiz decision 400 dönüyor", badDecision.status === 400, badDecision.status);

  // ===== 6) Öğretmen kendi seansını onaylar =====
  const approveRes = await fetch(`${BASE}/api/teacher/study-sessions/${suggested.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  const approveBody = await approveRes.json();
  check("POST respond: 200 dönüyor", approveRes.status === 200, approveRes.status);
  check("POST respond: durum TEACHER_APPROVED oldu", approveBody.session?.status === "TEACHER_APPROVED", approveBody.session?.status);

  const dbSession = await prisma.studySession.findUnique({ where: { id: suggested.id } });
  check("DB: seans gerçekten TEACHER_APPROVED olarak kaydedilmiş", dbSession?.status === "TEACHER_APPROVED", dbSession?.status);

  // ===== 7) Aynı seansı tekrar yanıtlamaya çalışmak engellenmeli =====
  const dupRes = await fetch(`${BASE}/api/teacher/study-sessions/${suggested.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "REJECT" }),
  });
  check("POST respond (tekrar): 409 dönüyor", dupRes.status === 409, dupRes.status);
  const dbSessionAfter = await prisma.studySession.findUnique({ where: { id: suggested.id } });
  check("DB: ikinci denemeden sonra durum DEĞİŞMEDİ (hâlâ TEACHER_APPROVED)", dbSessionAfter?.status === "TEACHER_APPROVED", dbSessionAfter?.status);

  return finish();

  function finish() {
    console.log("\n=== ÖZET ===");
    const fails = results.filter((r) => !r.ok);
    console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
    return fails.length;
  }
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
