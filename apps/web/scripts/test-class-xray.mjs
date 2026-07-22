// AI Sınıf Röntgeni API'sinin GERÇEK bir Postgres'e karşı uçtan uca
// doğrulaması — taksit tahsilatı ve etüt onay/red'deki deseni (gerçek DB +
// RLS + oturum tabanlı kimlik) üçüncü bir alana tekrarlar. Önkoşullar:
// migration + kökten `npm run seed` uygulanmış, `npm run dev` çalışıyor olmalı.
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
  const exam = await prisma.exam.findFirst({ where: { name: "9. Sınıf Genel Deneme #4" } });
  const classroom = await prisma.classroom.findFirst({ where: { name: "9-A" } });
  if (!exam || !classroom) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Login: öğretmen girişi başarılı", !!teacherCookie);

  // ===== 1) Oturum olmadan erişim engellenmeli =====
  const noSession = await fetch(`${BASE}/api/teacher/exams/${exam.id}/class-xray?classroomId=${classroom.id}`);
  check("GET class-xray: oturum yoksa 401 dönüyor", noSession.status === 401, noSession.status);

  // ===== 2) Girdi doğrulama: classroomId eksikse 400 =====
  const noClassroom = await fetch(`${BASE}/api/teacher/exams/${exam.id}/class-xray`, {
    headers: { Cookie: teacherCookie },
  });
  check("GET class-xray: classroomId eksikse 400 dönüyor", noClassroom.status === 400, noClassroom.status);

  // ===== 3) Var olmayan sınav/sınıf 404 =====
  const badExam = await fetch(`${BASE}/api/teacher/exams/not-a-real-id/class-xray?classroomId=${classroom.id}`, {
    headers: { Cookie: teacherCookie },
  });
  check("GET class-xray: var olmayan examId 404 dönüyor", badExam.status === 404, badExam.status);

  // ===== 4) Öğretmen kendi sınıfının gerçek ısı haritasını görür =====
  const res = await fetch(`${BASE}/api/teacher/exams/${exam.id}/class-xray?classroomId=${classroom.id}`, {
    headers: { Cookie: teacherCookie },
  });
  const body = await res.json();
  check("GET class-xray: 200 dönüyor", res.status === 200, res.status);
  check("GET class-xray: 4 kazanım kolonu var", body.achievementColumns?.length === 4, body.achievementColumns?.length);
  check("GET class-xray: 4 öğrenci listeleniyor", body.students?.length === 4, body.students?.length);

  const elif = body.students?.find((s) => s.fullName === "Elif Yılmaz");
  check("GET class-xray: Elif Yılmaz listede", !!elif);
  check("GET class-xray: Elif'in net skoru DB'deki gerçek ExamResult ile eşleşiyor", elif?.overallNet === 12.5, elif?.overallNet);
  check("GET class-xray: Elif'in her kazanım için bir hücresi var", elif?.cells?.length === 4, elif?.cells?.length);

  const dbResult = await prisma.examResult.findFirst({
    where: { examId: exam.id, student: { studentNo: "201001" } },
    include: { achievementResults: true },
  });
  const matCell = elif?.cells?.find((c) => c.achievementId === dbResult.achievementResults.find((r) => r.correctCount === 4)?.achievementId);
  check("GET class-xray: kazanım hücresi DB'deki correctRatio ile eşleşiyor", matCell?.correctRatio === 0.8, matCell?.correctRatio);
  check("GET class-xray: masteryLevel doğru türetilmiş (0.8 -> STRONG)", matCell?.masteryLevel === "STRONG", matCell?.masteryLevel);

  check(
    "GET class-xray: classSummary.averageNet gerçek verilerden hesaplanmış",
    typeof body.classSummary?.averageNet === "number" && body.classSummary.averageNet > 0,
    body.classSummary?.averageNet,
  );
  check("GET class-xray: en zayıf/en güçlü kazanım belirlenmiş", !!body.classSummary?.weakestAchievement?.achievementId && !!body.classSummary?.strongestAchievement?.achievementId);

  // ===== 5) Yetki: STUDENT rolü erişemez =====
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const asStudent = await fetch(`${BASE}/api/teacher/exams/${exam.id}/class-xray?classroomId=${classroom.id}`, {
    headers: { Cookie: studentCookie },
  });
  check("Yetki: STUDENT rolü class-xray'i göremiyor (403)", asStudent.status === 403, asStudent.status);

  // ===== 6) Tenant izolasyonu: Çankaya yöneticisi bu sınıfı/sınavı göremez =====
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  const asCankaya = await fetch(`${BASE}/api/teacher/exams/${exam.id}/class-xray?classroomId=${classroom.id}`, {
    headers: { Cookie: cankayaCookie },
  });
  check(
    "Yetki/tenant: Çankaya yöneticisi (farklı tenant + yanlış rol) erişemiyor",
    asCankaya.status === 403 || asCankaya.status === 404,
    asCankaya.status,
  );

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
