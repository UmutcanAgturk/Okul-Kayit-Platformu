// Karne modülünün GERÇEK bir Postgres veritabanına karşı uçtan uca
// doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış (Elif Yılmaz
// için AI Sınıf Röntgeni sınav sonuçları seed'de oluşturulur), `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (Devamsızlık ile birebir aynı desen — STUDENT
// yalnızca kendi kaydını, PARENT yalnızca velisi olduğu öğrencinin kaydını,
// TEACHER/BRANCH_ADMIN her öğrenciyi görebiliyor, tenant izolasyonu), sınav
// geçmişinin doğru döndüğü, ders bazlı başarı (subjectBreakdown) hesabının
// StudentAchievementResult'tan doğru türetildiği.
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

  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!studentCookie && !!otherStudentCookie && !!parentCookie && !!teacherCookie && !!cankayaCookie,
  );

  const noSession = await fetch(`${BASE}/api/students/${elif.id}/report-card`);
  check("GET report-card: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  const ownRes = await fetch(`${BASE}/api/students/${elif.id}/report-card`, { headers: { Cookie: studentCookie } });
  const ownBody = await ownRes.json();
  check("GET report-card: STUDENT kendi karnesini görebiliyor (200)", ownRes.status === 200, ownRes.status);
  check("Sınav geçmişi: '9. Sınıf Genel Deneme #4' listede", ownBody.examHistory?.some((e) => e.examName === "9. Sınıf Genel Deneme #4"));

  const matSubject = ownBody.subjectBreakdown?.find((s) => s.subject === "Matematik");
  const fizSubject = ownBody.subjectBreakdown?.find((s) => s.subject === "Fizik");
  const turSubject = ownBody.subjectBreakdown?.find((s) => s.subject === "Türkçe");
  check(
    "Ders bazlı başarı: Matematik iki kazanımın (0.8, 0.6) ortalaması %70",
    matSubject?.avgMasteryPct === 70 && matSubject?.achievementCount === 2,
    JSON.stringify(matSubject),
  );
  check("Ders bazlı başarı: Fizik %40", fizSubject?.avgMasteryPct === 40, JSON.stringify(fizSubject));
  check("Ders bazlı başarı: Türkçe %100", turSubject?.avgMasteryPct === 100, JSON.stringify(turSubject));
  check(
    "attendanceSummary alanları mevcut",
    typeof ownBody.attendanceSummary?.totalDays === "number" && typeof ownBody.attendanceSummary?.absenceRatePct === "number",
  );

  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/report-card`, { headers: { Cookie: otherStudentCookie } });
  check("Yetki: başka bir STUDENT Elif'in karnesini GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/report-card`, { headers: { Cookie: parentCookie } });
  check("GET report-card: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const teacherRes = await fetch(`${BASE}/api/students/${elif.id}/report-card`, { headers: { Cookie: teacherCookie } });
  check("GET report-card: TEACHER (personel) görebiliyor (200)", teacherRes.status === 200, teacherRes.status);

  const cankayaRes = await fetch(`${BASE}/api/students/${elif.id}/report-card`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaRes.status === 404,
    cankayaRes.status,
  );

  const missingRes = await fetch(`${BASE}/api/students/does-not-exist/report-card`, { headers: { Cookie: teacherCookie } });
  check("GET report-card: olmayan öğrenci için 404 dönüyor", missingRes.status === 404, missingRes.status);

  // ===== TEACHER'ın Karne ekranındaki gerçek akışı: /api/branch/students 403
  // verdiği için (yalnızca BRANCH_ADMIN/GUIDANCE_COORDINATOR) UI artık
  // /api/teacher/my-classes'tan kendi roster'ını çekiyor (bkz.
  // components/report-card/ReportCardView.tsx StaffReportCardView) =====
  const branchStudentsAsTeacherRes = await fetch(`${BASE}/api/branch/students`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER /api/branch/students'ı GÖREMİYOR (403 — bu yüzden Karne artık my-classes kullanıyor)", branchStudentsAsTeacherRes.status === 403, branchStudentsAsTeacherRes.status);

  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const slot = await prisma.timetableSlot.create({
    data: { tenantId: elif.tenantId, classroomId: elif.classroomId, teacherId: teacherProfile.id, subject: "Matematik", dayOfWeek: 3, startTime: "11:00", endTime: "11:40" },
  });
  try {
    const myClassesRes = await fetch(`${BASE}/api/teacher/my-classes`, { headers: { Cookie: teacherCookie } });
    const myClassesBody = await myClassesRes.json();
    const elifFromMyClasses = myClassesBody.classrooms?.flatMap((c) => c.students).find((s) => s.studentNo === "201001");
    check("Karne akışı: TEACHER, my-classes üzerinden Elif'i bulabiliyor", !!elifFromMyClasses, elifFromMyClasses);

    const reportCardViaTeacherRes = await fetch(`${BASE}/api/students/${elifFromMyClasses.studentId}/report-card`, { headers: { Cookie: teacherCookie } });
    check("Karne akışı: TEACHER, my-classes'tan bulduğu öğrencinin karnesini açabiliyor (200)", reportCardViaTeacherRes.status === 200, reportCardViaTeacherRes.status);
  } finally {
    await prisma.timetableSlot.delete({ where: { id: slot.id } });
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
