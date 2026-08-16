// Öğretmen Performansı modülünün (app/api/branch/teacher-performance) GERÇEK
// bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER 403, oturumsuz 401), Ayşe Demir'in
// (Matematik) sonucunun ham StudentAchievementResult ortalamasıyla eşleştiği,
// VE EN ÖNEMLİSİ tenant izolasyonu — StudentAchievementResult tablosunda RLS
// olmadığından (bkz. route dosyasındaki not) burada Çankaya şubesinin
// verisinin Mezitli'nin ortalamasına KARIŞMADIĞI ayrıca doğrulanır.
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
  const mezitliTeacher = await prisma.teacherProfile.findFirst({
    where: { user: { email: "ayse.demir@seviye360.com" } },
    include: { user: true },
  });
  if (!mezitliTeacher) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!cankayaCookie);

  const noSession = await fetch(`${BASE}/api/branch/teacher-performance`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherRes = await fetch(`${BASE}/api/branch/teacher-performance`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER göremez (403)", teacherRes.status === 403, teacherRes.status);

  const res = await fetch(`${BASE}/api/branch/teacher-performance`, { headers: { Cookie: branchCookie } });
  const body = await res.json();
  check("GET: BRANCH_ADMIN görüntüleyebiliyor (200)", res.status === 200, res.status);

  const ayseRow = body.teachers?.find((t) => t.teacherId === mezitliTeacher.id);
  check("Ayşe Demir listede ve branşı Matematik", ayseRow?.branch === "Matematik", ayseRow);

  // Ham veriyle çapraz doğrulama — YALNIZCA Mezitli'nin StudentAchievementResult'ları.
  const mezitliRatios = await prisma.studentAchievementResult.findMany({
    where: { student: { tenantId: mezitliTeacher.user.tenantId }, achievement: { code: { startsWith: "MAT." } } },
  });
  const expectedAvg = mezitliRatios.length > 0 ? Math.round((mezitliRatios.reduce((s, r) => s + r.correctRatio, 0) / mezitliRatios.length) * 100) : null;
  check(
    "Ayşe Demir'in avgMasteryPct'i ham Mezitli verisiyle eşleşiyor",
    ayseRow?.avgMasteryPct === expectedAvg,
    { got: ayseRow?.avgMasteryPct, expected: expectedAvg, resultCount: ayseRow?.resultCount, rawCount: mezitliRatios.length },
  );

  // Tenant izolasyonu: Çankaya'nın KENDİ Matematik öğretmeni (varsa) Mezitli'nin
  // verisiyle KARIŞMAMALI. Çankaya admin'inin gördüğü liste kendi tenant'ına
  // scope edilmiş olmalı — Mezitli'nin öğretmeni (Ayşe Demir) listede olmamalı.
  const cankayaRes = await fetch(`${BASE}/api/branch/teacher-performance`, { headers: { Cookie: cankayaCookie } });
  const cankayaBody = await cankayaRes.json();
  check(
    "Tenant izolasyonu: Çankaya admin'i Mezitli öğretmenini GÖRMÜYOR",
    !cankayaBody.teachers?.some((t) => t.teacherId === mezitliTeacher.id),
    cankayaBody.teachers?.map((t) => t.name),
  );

  // ===== Özet kartları — task #62 =====
  check(
    "GET: summary.totalTeachers/avgAttendancePct/totalRoster alanları içeriyor",
    typeof body.summary?.totalTeachers === "number" &&
      "avgAttendancePct" in (body.summary ?? {}) &&
      typeof body.summary?.totalRoster === "number",
    JSON.stringify(body.summary),
  );
  check("summary.totalTeachers listedeki öğretmen sayısıyla eşleşiyor", body.summary?.totalTeachers === body.teachers?.length, body.summary?.totalTeachers);
  check(
    "Ayşe Demir satırı classroomCodes/rosterSize/avgAttendancePct/positiveCount/negativeCount içeriyor (henüz TimetableSlot yoksa 0/boş/null)",
    Array.isArray(ayseRow?.classroomCodes) &&
      typeof ayseRow?.rosterSize === "number" &&
      "avgAttendancePct" in (ayseRow ?? {}) &&
      typeof ayseRow?.positiveCount === "number" &&
      typeof ayseRow?.negativeCount === "number",
    JSON.stringify(ayseRow),
  );

  // ===== TimetableSlot varlığında Sınıflar/Öğrenci sütununun gerçekten dolduğu =====
  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const classroom = await prisma.classroom.findUnique({ where: { id: elif.classroomId } });
  const slotPostRes = await fetch(`${BASE}/api/branch/timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: elif.classroomId, teacherId: mezitliTeacher.id, subject: "Matematik", dayOfWeek: 0, startTime: "09:00", endTime: "09:40" }),
  });
  const slotPostBody = await slotPostRes.json();
  check("POST timetable: test slotu oluşturuldu (201)", slotPostRes.status === 201, slotPostRes.status);

  const resAfterSlot = await fetch(`${BASE}/api/branch/teacher-performance`, { headers: { Cookie: branchCookie } });
  const bodyAfterSlot = await resAfterSlot.json();
  const ayseRowAfterSlot = bodyAfterSlot.teachers?.find((t) => t.teacherId === mezitliTeacher.id);
  check(
    "TimetableSlot eklendikten sonra Ayşe Demir'in Sınıflar listesinde sınıf var",
    ayseRowAfterSlot?.classroomCodes?.includes(classroom.name),
    ayseRowAfterSlot?.classroomCodes,
  );
  check("TimetableSlot eklendikten sonra rosterSize > 0", ayseRowAfterSlot?.rosterSize > 0, ayseRowAfterSlot?.rosterSize);

  // Temizlik
  await prisma.timetableSlot.delete({ where: { id: slotPostBody.slot.id } });

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
