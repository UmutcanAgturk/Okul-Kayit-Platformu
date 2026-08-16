// Normal Kayıt — Toplu Yükleme modülünün (app/api/branch/students/bulk-import)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER 403, oturumsuz 401), boş/aşırı büyük
// rows reddi, karışık bir istekte (1 geçerli + 1 eksik alan + 1 yanlış
// tenant'a ait classroomId) her satırın BAĞIMSIZ sonuçlandığı (bir satırın
// hatası diğerlerini geri almıyor), başarılı satırın gerçek bir
// User+StudentProfile+PaymentInstallment[]+Enrollment(KAYIT_TAMAMLANDI)
// oluşturduğu, ve Aktivite Akışı'na yansıması. Oluşturduğu tüm kayıtları
// sonunda temizler.
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
  const cankayaClassroom = await prisma.classroom.findFirst({ where: { NOT: { tenant: { code: "MEZITLI-01" } } } });
  if (!cankayaClassroom) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie);

  const base = `${BASE}/api/branch/students/bulk-import`;
  const uniqueName = `Test Toplu ${Date.now()}`;

  const noSession = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: [] }) });
  check("POST: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ rows: [{ candidateFullName: "x" }] }),
  });
  check("Yetki: TEACHER toplu kayıt yapamaz (403)", teacherRes.status === 403, teacherRes.status);

  const emptyRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ rows: [] }),
  });
  check("POST: boş rows 400", emptyRes.status === 400, emptyRes.status);

  const mixedRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({
      rows: [
        {
          candidateFullName: uniqueName,
          candidateGradeLevel: "SINIF_9",
          guardianFullName: "Test Veli",
          guardianPhone: "05551234567",
          installmentCount: 3,
          installmentAmount: 1000,
          firstDueDate: "2026-09-01",
        },
        { candidateFullName: "Eksik Alanlı Aday" }, // eksik alanlar
        {
          candidateFullName: "Yanlış Şube Adayı",
          candidateGradeLevel: "SINIF_9",
          guardianFullName: "Test Veli 2",
          guardianPhone: "05551234568",
          classroomId: cankayaClassroom.id, // Mezitli admin için başka tenant'ın sınıfı
          installmentCount: 1,
          installmentAmount: 1000,
          firstDueDate: "2026-09-01",
        },
      ],
    }),
  });
  const mixedBody = await mixedRes.json();
  check("POST: karışık istek 201 dönüyor", mixedRes.status === 201, mixedRes.status);
  check("successCount: 1, errorCount: 2", mixedBody.successCount === 1 && mixedBody.errorCount === 2, mixedBody);
  check("Satır 0 (geçerli): kind=ok", mixedBody.results?.[0]?.kind === "ok", mixedBody.results?.[0]);
  check("Satır 1 (eksik alan): kind=error", mixedBody.results?.[1]?.kind === "error", mixedBody.results?.[1]);
  check(
    "Satır 2 (yanlış tenant sınıfı): kind=error (bad_classroom)",
    mixedBody.results?.[2]?.kind === "error",
    mixedBody.results?.[2],
  );

  const createdStudentNo = mixedBody.results?.[0]?.studentNo;
  const dbUser = await prisma.user.findFirst({ where: { studentProfile: { studentNo: createdStudentNo } }, include: { studentProfile: { include: { installments: true } } } });
  check("DB: User gerçekten oluşturuldu (role=STUDENT)", dbUser?.role === "STUDENT", dbUser?.email);
  check("DB: 3 taksit oluşturuldu", dbUser?.studentProfile?.installments?.length === 3, dbUser?.studentProfile?.installments?.length);

  const enrollment = await prisma.enrollment.findFirst({ where: { candidateFullName: uniqueName } });
  check("DB: Enrollment KAYIT_TAMAMLANDI olarak oluşturuldu", enrollment?.stage === "KAYIT_TAMAMLANDI", enrollment?.stage);

  const lastLog = await prisma.auditLogEntry.findFirst({
    where: { action: "Toplu kayıt: öğrenci eklendi" },
    orderBy: { createdAt: "desc" },
  });
  check("Aktivite Akışı: toplu kayıt loglandı", lastLog?.detail?.includes(uniqueName), lastLog?.detail);

  const overLimitRows = Array.from({ length: 201 }, () => ({ candidateFullName: "x" }));
  const overLimitRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ rows: overLimitRows }),
  });
  check("POST: 200 satır sınırı aşılınca 400", overLimitRes.status === 400, overLimitRes.status);

  // ===== Temizlik =====
  if (dbUser) {
    await prisma.enrollment.deleteMany({ where: { studentId: dbUser.studentProfile.id } });
    await prisma.paymentInstallment.deleteMany({ where: { studentId: dbUser.studentProfile.id } });
    await prisma.user.delete({ where: { id: dbUser.id } });
  }
  const remaining = await prisma.user.count({ where: { firstName: { contains: "Test" }, lastName: { contains: "Toplu" } } });
  check("Temizlik: test kullanıcısı kalmadı", remaining === 0, remaining);

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
