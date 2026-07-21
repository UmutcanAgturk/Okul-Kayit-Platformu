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

const prisma = new PrismaClient();
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
  const listRes = await fetch(`${BASE}/api/students/${student.id}/installments`);
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
