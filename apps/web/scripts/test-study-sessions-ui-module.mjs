// Etüt Modülü ekranlarının (GET /api/students/[studentId]/study-sessions +
// mevcut GET/POST /api/teacher/study-sessions.../respond) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış (AI_SUGGESTED bir StudySession fixture'ı oluşturur), `npm run
// dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: öğrenci/veli kendi/velisi olduğu öğrencinin seanslarını
// görebiliyor (başka öğrenci/veli GÖREMİYOR — 403), oturumsuz 401, öğretmen
// tarafında yeni oluşturulan (tek kullanımlık, sonda silinen) bir seansın
// onay/red akışının uçtan uca çalıştığı ve zaten yanıtlanmış bir seansın
// tekrar yanıtlanamadığı (409).
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
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  const ahmet = await prisma.studentProfile.findFirst({ where: { studentNo: "201003" } });
  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const achievement = await prisma.curriculumNode.findFirst({ where: { code: "MAT.9.1.2.3" } });
  if (!elif || !ahmet || !teacherProfile || !achievement) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const elifCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const ahmetCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: tüm roller için giriş başarılı", !!elifCookie && !!ahmetCookie && !!parentCookie && !!teacherCookie);

  const noSession = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const elifRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, { headers: { Cookie: elifCookie } });
  const elifBody = await elifRes.json();
  check(
    "GET: Elif kendi seed fixture'ını (MAT.9.1.2.3) görebiliyor",
    elifRes.status === 200 && elifBody.sessions?.some((s) => s.achievement.code === "MAT.9.1.2.3"),
    elifBody,
  );

  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, { headers: { Cookie: ahmetCookie } });
  check("Yetki: başka bir STUDENT Elif'in seanslarını GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, { headers: { Cookie: parentCookie } });
  check("GET: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const parentForbiddenRes = await fetch(`${BASE}/api/students/${ahmet.id}/study-sessions`, { headers: { Cookie: parentCookie } });
  check("Yetki: velisi olmadığı Ahmet'in seanslarını GÖREMİYOR (403)", parentForbiddenRes.status === 403, parentForbiddenRes.status);

  // ===== Öğretmen onay/red akışı — tek kullanımlık seans =====
  const throwaway = await prisma.studySession.create({
    data: {
      tenantId: elif.tenantId,
      studentId: elif.id,
      teacherId: teacherProfile.id,
      achievementId: achievement.id,
      status: "AI_SUGGESTED",
      source: "AI_AUTO_ASSIGNED",
      scheduledStart: new Date(Date.UTC(2026, 8, 1, 10, 0)),
      scheduledEnd: new Date(Date.UTC(2026, 8, 1, 10, 40)),
    },
  });

  try {
    const teacherListRes = await fetch(`${BASE}/api/teacher/study-sessions`, { headers: { Cookie: teacherCookie } });
    const teacherListBody = await teacherListRes.json();
    check(
      "GET teacher/study-sessions: yeni seans listede",
      teacherListRes.status === 200 && teacherListBody.sessions?.some((s) => s.id === throwaway.id),
      teacherListBody.sessions?.length,
    );

    const approveRes = await fetch(`${BASE}/api/teacher/study-sessions/${throwaway.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: teacherCookie },
      body: JSON.stringify({ decision: "APPROVE" }),
    });
    const approveBody = await approveRes.json();
    check("POST respond: onaylama başarılı (200)", approveRes.status === 200 && approveBody.session?.status === "TEACHER_APPROVED", approveBody);

    const secondRes = await fetch(`${BASE}/api/teacher/study-sessions/${throwaway.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: teacherCookie },
      body: JSON.stringify({ decision: "REJECT" }),
    });
    check("POST respond: zaten yanıtlanmış seans tekrar yanıtlanamıyor (409)", secondRes.status === 409, secondRes.status);

    const studentViewRes = await fetch(`${BASE}/api/students/${elif.id}/study-sessions`, { headers: { Cookie: elifCookie } });
    const studentViewBody = await studentViewRes.json();
    const approvedRow = studentViewBody.sessions?.find((s) => s.id === throwaway.id);
    check("Öğrenci tarafında güncel durum (TEACHER_APPROVED) görünüyor", approvedRow?.status === "TEACHER_APPROVED", approvedRow);
  } finally {
    await prisma.studySession.delete({ where: { id: throwaway.id } });
  }

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
