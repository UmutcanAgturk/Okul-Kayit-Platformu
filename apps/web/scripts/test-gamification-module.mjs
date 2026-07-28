// Gamification (XP/Seviye/Rozet/Lider Tablosu) modülünün GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
// Yeni bir Prisma modeli/migration EKLEMEZ — XP tamamen gerçek ExamResult/
// AttendanceRecord/StudySession/DisciplineRecord/ClubMembership/QuizAttempt
// verisinden hesaplanır (bkz. apps/web/lib/gamification.ts).
//
// Kontrol ettikleri:
//   1. Yetki: oturumsuz 401; başka bir şubenin BRANCH_ADMIN'i bu öğrencinin
//      başarı verisini göremez (403 — tenant izolasyonu).
//   2. Başlangıç XP'sinin (yalnızca seed'deki 1 sınav sonucundan) doğru
//      hesaplandığı: 40 + round(net*4).
//   3. Yeni bir devamsızlık (VAR), disiplin kaydı (+5), kulüp üyeliği ve 3
//      pratik quiz denemesi eklendikten sonra XP'nin ve ilgili 4 rozetin
//      (devamlı, sosyal kelebek, pratik ustası — usta/ilk-adım zaten
//      seed'den kazanılmıştı) doğru şekilde arttığı.
//   4. Lider Tablosu'nun (BRANCH_ADMIN + TEACHER) güncel XP ile sıralandığı.
import { PrismaClient, AttendanceStatus, DisciplineType } from "@prisma/client";

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
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  check("STUDENT login başarılı", !!studentCookie);
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Çankaya) login başarılı", !!otherBranchAdminCookie);

  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const classroom = await prisma.classroom.findFirst({ where: { name: "9-A", tenant: { code: "MEZITLI-01" } } });
  const teacherUser = await prisma.user.findFirst({ where: { email: "merve.aslan@seviye360.com" } });
  const examResult = await prisma.examResult.findFirst({ where: { studentId: elif.id } });

  // ===== Yetki kontrolleri =====
  const noAuthRes = await fetch(`${BASE}/api/students/${elif.id}/gamification`);
  check("GET gamification: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const otherBranchRes = await fetch(`${BASE}/api/students/${elif.id}/gamification`, { headers: { Cookie: otherBranchAdminCookie } });
  check(
    "Çankaya admin Mezitli öğrencisini göremez: 404 (tenant varlığı sızdırılmaz, bkz. prisma/rls/README.md)",
    otherBranchRes.status === 404,
    otherBranchRes.status,
  );

  // ===== Başlangıç XP (seed'deki 1 sınav sonucu + 1 onaylı etütten) =====
  const etutJoinedBefore = await prisma.studySession.count({
    where: { studentId: elif.id, status: { in: ["TEACHER_APPROVED", "COMPLETED"] } },
  });
  const expectedBaseXp = 40 + Math.round(Math.max(0, examResult.netScore) * 4) + etutJoinedBefore * 15;
  const beforeRes = await fetch(`${BASE}/api/students/${elif.id}/gamification`, { headers: { Cookie: studentCookie } });
  const beforeBody = await beforeRes.json();
  check("Başlangıç XP doğru hesaplandı", beforeBody.xp === expectedBaseXp, `${beforeBody.xp} vs ${expectedBaseXp}`);
  check("Başlangıçta 'ilk-adim' rozeti kazanılmış", beforeBody.badges?.find((b) => b.id === "ilk-adim")?.earned === true);
  check("Başlangıçta 'devamli' rozeti henüz kazanılmamış", beforeBody.badges?.find((b) => b.id === "devamli")?.earned === false);
  check("Başlangıçta 'sosyal-kelebek' rozeti henüz kazanılmamış", beforeBody.badges?.find((b) => b.id === "sosyal-kelebek")?.earned === false);
  check("Başlangıçta 'pratik-ustasi' rozeti henüz kazanılmamış", beforeBody.badges?.find((b) => b.id === "pratik-ustasi")?.earned === false);

  // ===== Fixture: devamsızlık (VAR), disiplin, kulüp üyeliği, 3 quiz denemesi =====
  const attendance = await prisma.attendanceRecord.create({
    data: {
      tenantId: classroom.tenantId,
      studentId: elif.id,
      classroomId: classroom.id,
      date: new Date(),
      status: AttendanceStatus.VAR,
      recordedByUserId: teacherUser.id,
    },
  });
  const discipline = await prisma.disciplineRecord.create({
    data: {
      tenantId: classroom.tenantId,
      studentId: elif.id,
      type: DisciplineType.OLUMLU,
      category: "Derse Katılım",
      points: 5,
      recordedByUserId: teacherUser.id,
    },
  });
  const club = await prisma.club.create({ data: { tenantId: classroom.tenantId, name: "Gamification Test Kulübü" } });
  const membership = await prisma.clubMembership.create({ data: { clubId: club.id, studentId: elif.id } });
  const quizAttempts = await Promise.all(
    [2, 2, 2].map((correctCount) =>
      prisma.quizAttempt.create({ data: { tenantId: classroom.tenantId, studentId: elif.id, subject: "Matematik", correctCount, totalCount: 5 } }),
    ),
  );

  const expectedNewXp = expectedBaseXp + 3 /* attendance VAR */ + 5 /* discipline */ + 20 /* club */ + 2 * 5 * 3 /* quiz */;

  const afterRes = await fetch(`${BASE}/api/students/${elif.id}/gamification`, { headers: { Cookie: studentCookie } });
  const afterBody = await afterRes.json();
  check("Fixture sonrası XP doğru arttı", afterBody.xp === expectedNewXp, `${afterBody.xp} vs ${expectedNewXp}`);
  check("Fixture sonrası 'devamli' rozeti kazanıldı", afterBody.badges?.find((b) => b.id === "devamli")?.earned === true);
  check("Fixture sonrası 'sosyal-kelebek' rozeti kazanıldı", afterBody.badges?.find((b) => b.id === "sosyal-kelebek")?.earned === true);
  check("Fixture sonrası 'pratik-ustasi' rozeti kazanıldı", afterBody.badges?.find((b) => b.id === "pratik-ustasi")?.earned === true);
  check("classSize en az 1", afterBody.classSize >= 1, afterBody.classSize);

  // ===== Lider Tablosu =====
  const branchLbRes = await fetch(`${BASE}/api/branch/leaderboard`, { headers: { Cookie: branchAdminCookie } });
  const branchLbBody = await branchLbRes.json();
  const branchEntry = branchLbBody.rows?.find((r) => r.studentId === elif.id);
  check("BRANCH_ADMIN lider tablosunda doğru XP", branchEntry?.xp === expectedNewXp, branchEntry?.xp);

  const teacherLbRes = await fetch(`${BASE}/api/branch/leaderboard`, { headers: { Cookie: teacherCookie } });
  check("TEACHER lider tablosuna erişebiliyor: 200", teacherLbRes.status === 200, teacherLbRes.status);
  const teacherLbBody = await teacherLbRes.json();
  check("TEACHER lider tablosunda da aynı öğrenci var", teacherLbBody.rows?.some((r) => r.studentId === elif.id));

  const studentLbRes = await fetch(`${BASE}/api/branch/leaderboard`, { headers: { Cookie: studentCookie } });
  check("STUDENT lider tablosunu göremez: 403", studentLbRes.status === 403, studentLbRes.status);

  // Temizlik
  await prisma.quizAttempt.deleteMany({ where: { id: { in: quizAttempts.map((q) => q.id) } } });
  await prisma.clubMembership.delete({ where: { clubId_studentId: { clubId: membership.clubId, studentId: membership.studentId } } });
  await prisma.club.delete({ where: { id: club.id } });
  await prisma.disciplineRecord.delete({ where: { id: discipline.id } });
  await prisma.attendanceRecord.delete({ where: { id: attendance.id } });

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
