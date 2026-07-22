// Taksit tahsilat API'sinin GERÇEK bir Postgres veritabanına karşı uçtan uca
// doğrulaması. Önkoşullar: `npx prisma migrate dev` uygulanmış olmalı, `npx tsx
// ../../prisma/seed.ts` ile seed verisi yüklenmiş olmalı ve `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. GET /api/students/:id/installments — 9 taksit, ilk 2'si PAID.
//   2. POST .../collect — bir sonraki PENDING taksiti tahsil eder, doğru
//      tutarda bir AccountingLedgerEntry (relatedInstallmentId ile) oluşturur.
//   3. Aynı taksiti ikinci kez tahsil etmeye çalışmak 409 döner (veri
//      çoğalmaz — demo'daki sayaç yaklaşımının aksine, hangi taksitin
//      ödendiği kalıcı ve tekilleştirilmiş olarak izlenir).
//   4. Eksik gövde -> 400, var olmayan taksit -> 404.
import { PrismaClient } from "@prisma/client";

// Bu script API'yi HTTP üzerinden çağırır (o yol artık app_role + RLS bağlamı
// kullanıyor, bkz. lib/db-context.ts) — ama test fixture'larını bulmak ve
// veritabanı durumunu bağımsız doğrulamak için OWNER bağlantısı (RLS'den
// muaf) kullanır; bu, test-rls-isolation.mjs'deki aynı prensiple tutarlıdır.
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public" } },
});
const BASE = "http://localhost:3000";
const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}${detail !== undefined ? " — " + detail : ""}`);
};

async function main() {
  const student = await prisma.studentProfile.findUnique({ where: { studentNo: "201001" } });
  const admin = await prisma.user.findUnique({ where: { email: "merve.aslan@seviye360.com" } });
  if (!student || !admin) {
    throw new Error("Seed verisi bulunamadı — önce `npx tsx ../../prisma/seed.ts` çalıştırın.");
  }

  // ===== 1) Başlangıç durumu =====
  const listRes = await fetch(`${BASE}/api/students/${student.id}/installments?requestedByUserId=${admin.id}`);
  const listBody = await listRes.json();
  const paidCount = listBody.installments.filter((i) => i.status === "PAID").length;
  const pendingCount = listBody.installments.filter((i) => i.status === "PENDING").length;
  check("GET: 9 taksit listeleniyor", listBody.installments.length === 9, listBody.installments.length);
  check("GET: en az 2 taksit PAID", paidCount >= 2, paidCount);

  const nextPending = listBody.installments.find((i) => i.status === "PENDING");
  if (!nextPending) throw new Error("Tahsil edilecek PENDING taksit kalmamış — veritabanını sıfırlayıp seed'i tekrar çalıştırın.");

  const ledgerCountBefore = await prisma.accountingLedgerEntry.count({ where: { relatedInstallmentId: nextPending.id } });
  check("Tahsilattan önce bu taksite bağlı ledger kaydı yok", ledgerCountBefore === 0, ledgerCountBefore);

  // ===== 2) Tahsilat =====
  const collectRes = await fetch(`${BASE}/api/branch/payment-installments/${nextPending.id}/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectedByUserId: admin.id }),
  });
  const collectBody = await collectRes.json();
  check("POST collect: 200 döndü", collectRes.status === 200, collectRes.status);
  check("POST collect: taksit PAID oldu", collectBody.installment?.status === "PAID", collectBody.installment?.status);
  check("POST collect: ledger tutarı taksit tutarıyla eşleşiyor", Number(collectBody.ledgerEntry?.amount) === Number(nextPending.amount), collectBody.ledgerEntry?.amount);
  check("POST collect: ledger doğru taksite bağlı (relatedInstallmentId)", collectBody.ledgerEntry?.relatedInstallmentId === nextPending.id);

  const dbInstallment = await prisma.paymentInstallment.findUnique({ where: { id: nextPending.id } });
  const dbLedger = await prisma.accountingLedgerEntry.findFirst({ where: { relatedInstallmentId: nextPending.id } });
  check("DB: taksit gerçekten PAID olarak kaydedilmiş", dbInstallment?.status === "PAID");
  check("DB: ledger kaydı gerçekten oluşturulmuş", !!dbLedger);

  // ===== 3) İkinci kez tahsilat — engellenmeli =====
  const dupRes = await fetch(`${BASE}/api/branch/payment-installments/${nextPending.id}/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectedByUserId: admin.id }),
  });
  check("POST collect (tekrar): 409 döndü", dupRes.status === 409, dupRes.status);
  const ledgerCountAfterDup = await prisma.accountingLedgerEntry.count({ where: { relatedInstallmentId: nextPending.id } });
  check("DB: ikinci denemede ledger ÇOĞALMADI (hâlâ tek kayıt)", ledgerCountAfterDup === 1, ledgerCountAfterDup);

  // ===== 4) Girdi doğrulama =====
  const missingBodyRes = await fetch(`${BASE}/api/branch/payment-installments/${nextPending.id}/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  check("POST collect (collectedByUserId eksik): 400 döndü", missingBodyRes.status === 400, missingBodyRes.status);

  const notFoundRes = await fetch(`${BASE}/api/branch/payment-installments/not-a-real-id/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectedByUserId: admin.id }),
  });
  check("POST collect (var olmayan taksit): 404 döndü", notFoundRes.status === 404, notFoundRes.status);

  // ===== 5) Tenant izolasyonu API SEVİYESİNDE de geçerli mi? =====
  // Çankaya (başka tenant) şube müdürü, Mezitli'nin bir taksitini görmeye/tahsil
  // etmeye çalışırsa RLS onu API'ye ulaşmadan önce zaten görünmez kılmalı —
  // "yasak" değil "bulunamadı" dönmeli (tenant varlığını sızdırmamak için).
  const cankayaAdmin = await prisma.user.findUnique({ where: { email: "onur.kaya@seviye360.com" } });
  const stillPending = await prisma.paymentInstallment.findFirst({ where: { studentId: student.id, status: "PENDING" } });
  if (cankayaAdmin && stillPending) {
    const crossTenantGet = await fetch(`${BASE}/api/students/${student.id}/installments?requestedByUserId=${cankayaAdmin.id}`);
    check("Tenant izolasyonu: Çankaya yöneticisi Mezitli öğrencisinin taksitlerini GÖREMİYOR (404)", crossTenantGet.status === 404, crossTenantGet.status);

    const crossTenantCollect = await fetch(`${BASE}/api/branch/payment-installments/${stillPending.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectedByUserId: cankayaAdmin.id }),
    });
    check("Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin taksitini TAHSİL EDEMİYOR (404)", crossTenantCollect.status === 404, crossTenantCollect.status);

    const stillPendingAfter = await prisma.paymentInstallment.findUnique({ where: { id: stillPending.id } });
    check("DB: cross-tenant deneme sonrası taksit hâlâ PENDING (değişmemiş)", stillPendingAfter.status === "PENDING", stillPendingAfter.status);
  } else {
    check("Tenant izolasyonu testi atlandı (Çankaya admin veya PENDING taksit yok)", false, "kurulum eksik");
  }

  // ===== 6) Yetkisiz rol: STUDENT tahsilat işleyemez (403) =====
  const studentUser = await prisma.user.findUnique({ where: { email: "elif.yilmaz@ogrenci.seviye360.com" } });
  const anotherPending = await prisma.paymentInstallment.findFirst({ where: { studentId: student.id, status: "PENDING" } });
  if (studentUser && anotherPending) {
    const asStudentRes = await fetch(`${BASE}/api/branch/payment-installments/${anotherPending.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectedByUserId: studentUser.id }),
    });
    check("Yetki: STUDENT rolü tahsilat işleyemiyor (403)", asStudentRes.status === 403, asStudentRes.status);
  }

  console.log("\n=== ÖZET ===");
  const fails = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await prisma.$disconnect();
  process.exit(fails.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
