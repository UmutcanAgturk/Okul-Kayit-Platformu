// Öğrenci Fotoğrafı (task #113) — Normal Kayıt'ta yükleme + StudentDetailDrawer'da
// görüntülemenin GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması.
// Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu
// (localhost:3000) çalışıyor olmalı.
//
// Bir CANDIDATE (Enrollment) oluşturup POST .../complete'i bir photoDataUrl ile
// çağırır, StudentProfile.photoDataUrl'un gerçekten yazıldığını ve
// GET .../detail'in bunu döndürdüğünü doğrular. Geçersiz data URI/boyut sınırı
// da kontrol edilir. Oluşturduğu tüm kayıtları sonunda temizler.
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

// 1x1 şeffaf PNG — küçük gerçek bir data URI (boyut testleri için ayrıca sahte uzun bir string kullanılır).
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function main() {
  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie);

  const enrollName = `Test Fotoğraf Adayı ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({
      type: "NORMAL_KAYIT",
      candidateFullName: enrollName,
      candidateGradeLevel: "SINIF_9",
      guardianFullName: "Test Veli",
      guardianPhone: `5${Math.floor(300000000 + Math.random() * 90000000)}`,
    }),
  });
  const createBody = await createRes.json();
  check("Kurulum: test adayı oluşturuldu (201)", createRes.status === 201, createBody);
  const enrollmentId = createBody.enrollment?.id;

  let studentId = null;
  try {
    // ===== Geçersiz photoDataUrl (data:image/ ile başlamıyor) =====
    const badRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({
        installmentCount: 1,
        installmentAmount: 1000,
        firstDueDate: "2026-09-01",
        nationalId: String(10000000000 + Math.floor(Math.random() * 89999999999)).slice(0, 11),
        photoDataUrl: "not-a-data-uri",
      }),
    });
    check("POST complete: geçersiz photoDataUrl 400", badRes.status === 400, badRes.status);

    // ===== Boyut sınırını aşan photoDataUrl =====
    const tooBigRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({
        installmentCount: 1,
        installmentAmount: 1000,
        firstDueDate: "2026-09-01",
        nationalId: String(10000000000 + Math.floor(Math.random() * 89999999999)).slice(0, 11),
        photoDataUrl: "data:image/png;base64," + "A".repeat(3_600_000),
      }),
    });
    check("POST complete: boyut limitini aşan photoDataUrl 400", tooBigRes.status === 400, tooBigRes.status);

    // ===== Geçerli fotoğrafla kayıt tamamlama =====
    const nationalId = String(10000000000 + Math.floor(Math.random() * 89999999999)).slice(0, 11);
    const completeRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({
        installmentCount: 1,
        installmentAmount: 1000,
        firstDueDate: "2026-09-01",
        nationalId,
        photoDataUrl: TINY_PNG_DATA_URL,
      }),
    });
    const completeBody = await completeRes.json();
    check("POST complete: 201 ve student.photoDataUrl döndü", completeRes.status === 201 && completeBody.student?.photoDataUrl === TINY_PNG_DATA_URL, completeRes.status);
    studentId = completeBody.student?.id;

    const dbStudent = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    check("DB: photoDataUrl gerçekten kalıcı olarak yazıldı", dbStudent?.photoDataUrl === TINY_PNG_DATA_URL, dbStudent?.photoDataUrl?.slice(0, 30));

    const detailRes = await fetch(`${BASE}/api/branch/students/${studentId}/detail`, { headers: { Cookie: branchCookie } });
    const detailBody = await detailRes.json();
    check("GET .../detail: photoDataUrl alanı döndü (StudentDetailDrawer'ın veri kaynağı)", detailBody.student?.photoDataUrl === TINY_PNG_DATA_URL, detailRes.status);

    // ===== Fotoğrafsız kayıt (opsiyonel — regresyon: eski davranış bozulmamış) =====
    const noPhotoEnrollRes = await fetch(`${BASE}/api/branch/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({
        type: "NORMAL_KAYIT",
        candidateFullName: `Test Fotoğrafsız Aday ${Date.now()}`,
        candidateGradeLevel: "SINIF_9",
        guardianFullName: "Test Veli 2",
        guardianPhone: `5${Math.floor(300000000 + Math.random() * 90000000)}`,
      }),
    });
    const noPhotoEnrollBody = await noPhotoEnrollRes.json();
    const noPhotoNationalId = String(10000000000 + Math.floor(Math.random() * 89999999999)).slice(0, 11);
    const noPhotoCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${noPhotoEnrollBody.enrollment.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate: "2026-09-01", nationalId: noPhotoNationalId }),
    });
    const noPhotoCompleteBody = await noPhotoCompleteRes.json();
    check("POST complete: photoDataUrl olmadan da 201 (opsiyonel alan regresyonu yok)", noPhotoCompleteRes.status === 201 && noPhotoCompleteBody.student?.photoDataUrl === null, noPhotoCompleteBody.student?.photoDataUrl);

    // Temizlik: fotoğrafsız test öğrencisi. Enrollment.studentId RESTRICT'tir
    // (bkz. şema) — StudentProfile'dan ÖNCE Enrollment'ı silmek zorundayız.
    const noPhotoStudentId = noPhotoCompleteBody.student?.id;
    if (noPhotoStudentId) {
      const s = await prisma.studentProfile.findUnique({ where: { id: noPhotoStudentId }, include: { guardians: true } });
      await prisma.enrollment.deleteMany({ where: { studentId: noPhotoStudentId } });
      await prisma.paymentInstallment.deleteMany({ where: { studentId: noPhotoStudentId } });
      for (const g of s.guardians) await prisma.studentGuardian.delete({ where: { studentId_parentId: { studentId: noPhotoStudentId, parentId: g.parentId } } });
      await prisma.studentProfile.delete({ where: { id: noPhotoStudentId } });
      await prisma.user.delete({ where: { id: s.userId } });
    }
  } finally {
    // ===== Temizlik: ana test öğrencisi + veli + kayıt =====
    if (studentId) {
      const s = await prisma.studentProfile.findUnique({ where: { id: studentId }, include: { guardians: { include: { parent: true } } } });
      if (s) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
        await prisma.paymentInstallment.deleteMany({ where: { studentId } });
        for (const g of s.guardians) {
          await prisma.studentGuardian.delete({ where: { studentId_parentId: { studentId, parentId: g.parentId } } });
          const remaining = await prisma.studentGuardian.count({ where: { parentId: g.parentId } });
          if (remaining === 0) {
            await prisma.parentProfile.delete({ where: { id: g.parentId } });
            await prisma.user.delete({ where: { id: g.parent.userId } });
          }
        }
        await prisma.studentProfile.delete({ where: { id: studentId } });
        await prisma.user.delete({ where: { id: s.userId } });
      }
    }
    await prisma.auditLogEntry.deleteMany({ where: { action: "Kayıt tamamlandı", detail: { contains: "Test Fotoğraf" } } });
    // Kalan (henüz tamamlanmamış olabilecek) test Enrollment satırlarını da temizle.
    await prisma.enrollment.deleteMany({ where: { candidateFullName: { contains: "Test Fotoğraf" } } });
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
