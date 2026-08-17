// Devamsızlık/Yoklama modülünün GERÇEK bir Postgres veritabanına karşı uçtan
// uca doğrulaması. Önkoşullar: `npx prisma migrate deploy` (attendance
// migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET /api/branch/classrooms — yetki, tenant izolasyonu.
//   2. GET/POST /api/branch/attendance — yoklama alma (bulk upsert), default
//      VAR durumu, sınıf/öğrenci uyuşmazlığı doğrulaması, tenant izolasyonu.
//   3. GET /api/students/[studentId]/attendance — STUDENT yalnızca kendi
//      kaydını, PARENT yalnızca velisi olduğu öğrencinin kaydını görebiliyor;
//      TEACHER/BRANCH_ADMIN her öğrenciyi görebiliyor; özet (summary) doğru
//      hesaplanıyor.
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
  const mezitli = await prisma.tenant.findUnique({ where: { code: "MEZITLI-01" } });
  if (!mezitli) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const otherStudentCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!teacherCookie && !!branchAdminCookie && !!studentCookie && !!otherStudentCookie && !!parentCookie && !!cankayaCookie,
  );

  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const classroomId = elif.classroomId;
  check("Kurulum: Elif bir sınıfa atanmış", !!classroomId);

  // ===== 1) GET /api/branch/classrooms =====
  const noSessionClassrooms = await fetch(`${BASE}/api/branch/classrooms`);
  check("GET classrooms: oturum yoksa 401 dönüyor", noSessionClassrooms.status === 401, noSessionClassrooms.status);

  const studentClassrooms = await fetch(`${BASE}/api/branch/classrooms`, { headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT rolü sınıf listesini göremiyor (403)", studentClassrooms.status === 403, studentClassrooms.status);

  const teacherClassrooms = await fetch(`${BASE}/api/branch/classrooms`, { headers: { Cookie: teacherCookie } });
  const teacherClassroomsBody = await teacherClassrooms.json();
  check("GET classrooms: TEACHER 200 dönüyor", teacherClassrooms.status === 200, teacherClassrooms.status);
  check(
    "GET classrooms: Elif'in sınıfı listede",
    teacherClassroomsBody.classrooms?.some((c) => c.id === classroomId),
  );

  const cankayaClassrooms = await fetch(`${BASE}/api/branch/classrooms`, { headers: { Cookie: cankayaCookie } });
  const cankayaClassroomsBody = await cankayaClassrooms.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin sınıfını GÖREMİYOR",
    !cankayaClassroomsBody.classrooms?.some((c) => c.id === classroomId),
  );

  // ===== 2) GET /api/branch/attendance — default VAR =====
  const date = "2026-07-20";
  const noSessionGet = await fetch(`${BASE}/api/branch/attendance?classroomId=${classroomId}&date=${date}`);
  check("GET attendance: oturum yoksa 401 dönüyor", noSessionGet.status === 401, noSessionGet.status);

  const invalidGet = await fetch(`${BASE}/api/branch/attendance?classroomId=${classroomId}`, { headers: { Cookie: teacherCookie } });
  check("GET attendance: date eksikse 400 dönüyor", invalidGet.status === 400, invalidGet.status);

  const firstGetRes = await fetch(`${BASE}/api/branch/attendance?classroomId=${classroomId}&date=${date}`, {
    headers: { Cookie: teacherCookie },
  });
  const firstGetBody = await firstGetRes.json();
  check("GET attendance: 200 dönüyor", firstGetRes.status === 200, firstGetRes.status);
  const elifRow = firstGetBody.students?.find((s) => s.studentId === elif.id);
  check("GET attendance: kayıt yoksa varsayılan VAR", elifRow?.status === "VAR", JSON.stringify(elifRow));

  const cankayaGetAttendance = await fetch(`${BASE}/api/branch/attendance?classroomId=${classroomId}&date=${date}`, {
    headers: { Cookie: cankayaCookie },
  });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin sınıfının yoklamasını göremiyor (404)",
    cankayaGetAttendance.status === 404,
    cankayaGetAttendance.status,
  );

  // ===== 3) POST /api/branch/attendance =====
  const noSessionPost = await fetch(`${BASE}/api/branch/attendance`, { method: "POST", body: JSON.stringify({}) });
  check("POST attendance: oturum yoksa 401 dönüyor", noSessionPost.status === 401, noSessionPost.status);

  const studentPost = await fetch(`${BASE}/api/branch/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ classroomId, date, records: [{ studentId: elif.id, status: "YOK" }] }),
  });
  check("Yetki: STUDENT rolü yoklama kaydedemiyor (403)", studentPost.status === 403, studentPost.status);

  const mismatchStudent = await prisma.studentProfile.findFirst({ where: { user: { email: "mehmet.kaya@ogrenci.seviye360.com" } } });
  const mismatchPost = await fetch(`${BASE}/api/branch/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ classroomId, date, records: [{ studentId: mismatchStudent.id, status: "YOK" }] }),
  });
  check(
    "POST attendance: başka sınıfın öğrencisi için 400 dönüyor",
    mismatchPost.status === 400,
    mismatchPost.status,
  );

  const savePostRes = await fetch(`${BASE}/api/branch/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({
      classroomId,
      date,
      records: [
        { studentId: elif.id, status: "YOK", note: "Hasta" },
      ],
    }),
  });
  check("POST attendance: öğretmen 200 alıyor", savePostRes.status === 200, savePostRes.status);

  // ===== task #104 (3. denetim): Aktivite Akışı'na "Yoklama kaydedildi" yazılıyor mu =====
  const attendanceLog = await prisma.auditLogEntry.findFirst({ where: { action: "Yoklama kaydedildi" }, orderBy: { createdAt: "desc" } });
  check("Aktivite Akışı: yoklama kaydı loglandı", !!attendanceLog && attendanceLog.detail?.includes(date), attendanceLog?.detail);

  const dbRecord = await prisma.attendanceRecord.findUnique({
    where: { studentId_date: { studentId: elif.id, date: new Date(`${date}T00:00:00.000Z`) } },
  });
  check("DB: yoklama kaydı doğru status/note ile oluşturuldu", dbRecord?.status === "YOK" && dbRecord?.note === "Hasta");

  const secondGetRes = await fetch(`${BASE}/api/branch/attendance?classroomId=${classroomId}&date=${date}`, {
    headers: { Cookie: branchAdminCookie },
  });
  const secondGetBody = await secondGetRes.json();
  const elifRowAfter = secondGetBody.students?.find((s) => s.studentId === elif.id);
  check(
    "GET attendance: BRANCH_ADMIN da güncel durumu görüyor (YOK)",
    elifRowAfter?.status === "YOK",
    JSON.stringify(elifRowAfter),
  );

  // Upsert testi: aynı gün için tekrar kaydet, status değişsin (update, create değil)
  const updatePostRes = await fetch(`${BASE}/api/branch/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ classroomId, date, records: [{ studentId: elif.id, status: "GEC" }] }),
  });
  check("POST attendance: aynı gün için ikinci kayıt (upsert) 200 alıyor", updatePostRes.status === 200, updatePostRes.status);
  const dbRecordAfterUpdate = await prisma.attendanceRecord.findUnique({
    where: { studentId_date: { studentId: elif.id, date: new Date(`${date}T00:00:00.000Z`) } },
  });
  check(
    "DB: upsert yeni satır oluşturmadı, mevcut satırı güncelledi",
    dbRecordAfterUpdate?.id === dbRecord?.id && dbRecordAfterUpdate?.status === "GEC",
  );

  // ===== 4) GET /api/students/[studentId]/attendance =====
  const noSessionStudentGet = await fetch(`${BASE}/api/students/${elif.id}/attendance`);
  check("GET student attendance: oturum yoksa 401 dönüyor", noSessionStudentGet.status === 401, noSessionStudentGet.status);

  const ownStudentGet = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: studentCookie } });
  const ownStudentGetBody = await ownStudentGet.json();
  check("GET student attendance: STUDENT kendi kaydını görebiliyor (200)", ownStudentGet.status === 200, ownStudentGet.status);
  check(
    "GET student attendance: kayıt GEC olarak listede",
    ownStudentGetBody.records?.some((r) => r.date === date && r.status === "GEC"),
    JSON.stringify(ownStudentGetBody.records),
  );
  check("GET student attendance: summary.totalDays >= 1", ownStudentGetBody.summary?.totalDays >= 1);

  const otherStudentGet = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: otherStudentCookie } });
  check(
    "Yetki: başka bir STUDENT Elif'in kaydını GÖREMİYOR (403)",
    otherStudentGet.status === 403,
    otherStudentGet.status,
  );

  const parentGet = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: parentCookie } });
  check("GET student attendance: velisi PARENT görebiliyor (200)", parentGet.status === 200, parentGet.status);

  const cankayaAdminParentCheck = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: cankayaCookie } });
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin öğrencisini GÖREMİYOR (404)",
    cankayaAdminParentCheck.status === 404,
    cankayaAdminParentCheck.status,
  );

  const teacherStudentGet = await fetch(`${BASE}/api/students/${elif.id}/attendance`, { headers: { Cookie: teacherCookie } });
  check("GET student attendance: TEACHER (personel) görebiliyor (200)", teacherStudentGet.status === 200, teacherStudentGet.status);

  // ===== 5) GET /api/branch/attendance-summary — şube geneli genel bakış (task #60) =====
  const noSessionSummary = await fetch(`${BASE}/api/branch/attendance-summary`);
  check("GET attendance-summary: oturum yoksa 401 dönüyor", noSessionSummary.status === 401, noSessionSummary.status);

  const teacherSummary = await fetch(`${BASE}/api/branch/attendance-summary`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü genel bakışı göremiyor (403)", teacherSummary.status === 403, teacherSummary.status);

  const adminSummaryRes = await fetch(`${BASE}/api/branch/attendance-summary`, { headers: { Cookie: branchAdminCookie } });
  const adminSummaryBody = await adminSummaryRes.json();
  check("GET attendance-summary: BRANCH_ADMIN 200 dönüyor", adminSummaryRes.status === 200, adminSummaryRes.status);
  check(
    "GET attendance-summary: Elif'in sınıfı listede",
    adminSummaryBody.classrooms?.some((c) => c.classroomId === classroomId),
    adminSummaryBody.classrooms?.map((c) => c.classroomId),
  );
  const elifClassroomSummary = adminSummaryBody.classrooms?.find((c) => c.classroomId === classroomId);
  check(
    "GET attendance-summary: sınıf satırı studentCount/daysTaken/absentRate içeriyor",
    typeof elifClassroomSummary?.studentCount === "number" &&
      typeof elifClassroomSummary?.daysTaken === "number" &&
      typeof elifClassroomSummary?.absentRate === "number" &&
      typeof elifClassroomSummary?.takenToday === "boolean",
    JSON.stringify(elifClassroomSummary),
  );
  check(
    "GET attendance-summary: branch summary classroomsTotal/takenTodayCount/avgAbsentRate içeriyor",
    typeof adminSummaryBody.summary?.classroomsTotal === "number" &&
      typeof adminSummaryBody.summary?.takenTodayCount === "number" &&
      typeof adminSummaryBody.summary?.avgAbsentRate === "number",
    JSON.stringify(adminSummaryBody.summary),
  );

  const cankayaSummary = await fetch(`${BASE}/api/branch/attendance-summary`, { headers: { Cookie: cankayaCookie } });
  const cankayaSummaryBody = await cankayaSummary.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin sınıflarını GÖREMİYOR",
    !cankayaSummaryBody.classrooms?.some((c) => c.classroomId === classroomId),
    cankayaSummaryBody.classrooms?.map((c) => c.classroomId),
  );

  // Temizlik
  await prisma.attendanceRecord.delete({ where: { studentId_date: { studentId: elif.id, date: new Date(`${date}T00:00:00.000Z`) } } });
  await prisma.auditLogEntry.deleteMany({ where: { action: "Yoklama kaydedildi", detail: { contains: date } } });

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
