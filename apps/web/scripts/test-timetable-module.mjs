// Ders Programı modülünün (app/api/branch/timetable + [slotId], app/api/teacher/timetable,
// app/api/students/[studentId]/timetable — TimetableSlot, YENİ Prisma modeli)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış, migration uygulanmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (yalnızca BRANCH_ADMIN ekleyebilir/silebilir,
// TEACHER/STUDENT/PARENT salt okunur görebilir), oturumsuz 401, sınıf/
// öğretmen çakışma kontrolü (409), geçersiz saat aralığı (400), tenant
// izolasyonu, öğretmenin kendi programını görebilmesi, öğrencinin kendi
// sınıfının programını görebilmesi, ve Aktivite Akışı'na yansıma.
// Oluşturduğu tüm kayıtları sonunda temizler.
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
  const classroom = await prisma.classroom.findFirst({ where: { name: "9-A" } });
  const teacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  if (!classroom || !teacher || !elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!studentCookie && !!parentCookie && !!cankayaCookie);

  const noSession = await fetch(`${BASE}/api/branch/timetable`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherWriteRes = await fetch(`${BASE}/api/branch/timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ classroomId: classroom.id, teacherId: teacher.id, subject: "Matematik", dayOfWeek: 0, startTime: "09:00", endTime: "09:40" }),
  });
  check("Yetki: TEACHER ders programına ekleyemez (403)", teacherWriteRes.status === 403, teacherWriteRes.status);

  const badTimeRes = await fetch(`${BASE}/api/branch/timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: classroom.id, teacherId: teacher.id, subject: "Matematik", dayOfWeek: 0, startTime: "10:00", endTime: "09:00" }),
  });
  check("POST: geçersiz saat aralığı 400", badTimeRes.status === 400, badTimeRes.status);

  const createRes = await fetch(`${BASE}/api/branch/timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: classroom.id, teacherId: teacher.id, subject: "Matematik", dayOfWeek: 0, startTime: "09:00", endTime: "09:40" }),
  });
  const createBody = await createRes.json();
  check("POST: BRANCH_ADMIN ders ekleyebiliyor (201)", createRes.status === 201, createBody);
  const slotId = createBody.slot?.id;

  try {
    const conflictClassroomRes = await fetch(`${BASE}/api/branch/timetable`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ classroomId: classroom.id, teacherId: teacher.id, subject: "Fizik", dayOfWeek: 0, startTime: "09:20", endTime: "10:00" }),
    });
    check("POST: aynı sınıf/gün/saat çakışması reddediliyor (409)", conflictClassroomRes.status === 409, conflictClassroomRes.status);

    const listRes = await fetch(`${BASE}/api/branch/timetable`, { headers: { Cookie: branchCookie } });
    const listBody = await listRes.json();
    check("GET branch: yeni ders listede", listBody.slots?.some((s) => s.id === slotId), listBody.slots?.length);

    const cankayaRes = await fetch(`${BASE}/api/branch/timetable`, { headers: { Cookie: cankayaCookie } });
    const cankayaBody = await cankayaRes.json();
    check(
      "Tenant izolasyonu: Çankaya admin'i Mezitli'nin dersini GÖRMÜYOR",
      !cankayaBody.slots?.some((s) => s.id === slotId),
      cankayaBody.slots?.length,
    );

    const teacherListRes = await fetch(`${BASE}/api/teacher/timetable`, { headers: { Cookie: teacherCookie } });
    const teacherListBody = await teacherListRes.json();
    check("GET teacher: kendi dersi listede", teacherListBody.slots?.some((s) => s.id === slotId), teacherListBody.slots?.length);

    const studentRes = await fetch(`${BASE}/api/students/${elif.id}/timetable`, { headers: { Cookie: studentCookie } });
    const studentBody = await studentRes.json();
    check("GET student: kendi sınıfının dersi listede", studentBody.slots?.some((s) => s.id === slotId), studentBody.slots?.length);

    const parentRes = await fetch(`${BASE}/api/students/${elif.id}/timetable`, { headers: { Cookie: parentCookie } });
    check("GET student: velisi de görebiliyor (200)", parentRes.status === 200, parentRes.status);

    const noSessionStudentRes = await fetch(`${BASE}/api/students/${elif.id}/timetable`);
    check("GET student: oturumsuz 401", noSessionStudentRes.status === 401, noSessionStudentRes.status);

    const deleteByTeacherRes = await fetch(`${BASE}/api/branch/timetable/${slotId}`, { method: "DELETE", headers: { Cookie: teacherCookie } });
    check("Yetki: TEACHER silemez (403)", deleteByTeacherRes.status === 403, deleteByTeacherRes.status);

    const lastLog = await prisma.auditLogEntry.findFirst({
      where: { action: "Ders programına eklendi" },
      orderBy: { createdAt: "desc" },
    });
    check("Aktivite Akışı: ekleme loglandı", !!lastLog, lastLog?.detail);
  } finally {
    const deleteRes = await fetch(`${BASE}/api/branch/timetable/${slotId}`, { method: "DELETE", headers: { Cookie: branchCookie } });
    check("DELETE: BRANCH_ADMIN silebiliyor (200)", deleteRes.status === 200, deleteRes.status);
    const remaining = await prisma.timetableSlot.count({ where: { id: slotId } });
    check("Temizlik: kayıt gerçekten silindi", remaining === 0, remaining);
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
