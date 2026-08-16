// Sınıflarım modülünün (app/api/teacher/my-classes) GERÇEK bir Postgres
// veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed`
// çalıştırılmış, `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (STUDENT 403, oturumsuz 401), öğretmenin ders
// programında hiç kaydı yokken boş liste döndüğü, bir TimetableSlot
// eklendiğinde ilgili sınıfın roster'ının (öğrenci no + net ortalama)
// doğru döndüğü. Test için geçici bir TimetableSlot oluşturur, sonunda siler.
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
  const teacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const classroom = await prisma.classroom.findFirst({ where: { name: "9-A" } });
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  if (!teacher || !classroom || !elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!teacherCookie && !!studentCookie);

  const noSession = await fetch(`${BASE}/api/teacher/my-classes`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const studentRes = await fetch(`${BASE}/api/teacher/my-classes`, { headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT göremez (403)", studentRes.status === 403, studentRes.status);

  const emptyRes = await fetch(`${BASE}/api/teacher/my-classes`, { headers: { Cookie: teacherCookie } });
  const emptyBody = await emptyRes.json();
  check("GET: ders programında kayıt yokken boş liste (200)", emptyRes.status === 200 && emptyBody.classrooms?.length === 0, emptyBody);

  const slot = await prisma.timetableSlot.create({
    data: {
      tenantId: elif.tenantId,
      classroomId: classroom.id,
      teacherId: teacher.id,
      subject: "Matematik",
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "09:40",
    },
  });

  try {
    const res = await fetch(`${BASE}/api/teacher/my-classes`, { headers: { Cookie: teacherCookie } });
    const body = await res.json();
    check("GET: slot eklenince sınıf listede (200)", res.status === 200 && body.classrooms?.length === 1, body.classrooms?.length);
    const cls = body.classrooms?.[0];
    check("Sınıf adı doğru (9-A)", cls?.classroomName === "9-A", cls?.classroomName);
    const elifRow = cls?.students?.find((s) => s.studentNo === "201001");
    check("Elif roster'da doğru öğrenci no ile görünüyor", elifRow?.studentNo === "201001", elifRow);
    check("Elif'in net ortalaması sayısal veya null", elifRow && (typeof elifRow.netAvg === "number" || elifRow.netAvg === null), elifRow?.netAvg);
  } finally {
    await prisma.timetableSlot.delete({ where: { id: slot.id } });
  }

  const afterCleanupRes = await fetch(`${BASE}/api/teacher/my-classes`, { headers: { Cookie: teacherCookie } });
  const afterCleanupBody = await afterCleanupRes.json();
  check("Temizlik: slot silinince liste tekrar boş", afterCleanupBody.classrooms?.length === 0, afterCleanupBody.classrooms?.length);

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
