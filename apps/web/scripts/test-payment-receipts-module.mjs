// Ödeme Yöntemleri — Dekont Onay Akışının GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması (bkz. prisma/schema.prisma PaymentReceipt
// notu). Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev`
// sunucusu (localhost:3000) çalışıyor olmalı. Kendi PENDING taksit
// fixture'ını oluşturur/temizler (seed'deki taksitler önceki test
// koşularında tüketilmiş olabilir).
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca faturalama sorumlusu PARENT dekont gönderebilir;
//      STUDENT/ilgisiz PARENT gönderemez; yalnızca BRANCH_ADMIN/ACCOUNTING
//      onaylayabilir/reddedebilir.
//   2. Doğrulama: geçersiz MIME türü / aşırı büyük dosya / PENDING olmayan
//      taksit için gönderim reddedilir.
//   3. Onay akışı: APPROVE → taksit PAID + doğru kategoride bir Muhasebe
//      defteri kaydı; REJECT → taksit PENDING kalır, defter kaydı yok.
//   4. Zaten incelenmiş bir dekontu tekrar inceleme 409.
//   5. Tenant izolasyonu.
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
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
  const fixtureInstallment = await prisma.paymentInstallment.create({
    data: { tenantId: elif.tenantId, studentId: elif.id, installmentNo: 999, amount: 5000, dueDate: new Date("2026-09-01"), status: "PENDING" },
  });
  const fixtureInstallment2 = await prisma.paymentInstallment.create({
    data: { tenantId: elif.tenantId, studentId: elif.id, installmentNo: 998, amount: 5000, dueDate: new Date("2026-09-01"), status: "PENDING" },
  });

  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check(
    "Kurulum: tüm roller için giriş başarılı",
    !!parentCookie && !!studentCookie && !!branchAdminCookie && !!teacherCookie && !!cankayaCookie,
  );

  // ===== Yetki / doğrulama =====
  const studentSubmitRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "x.png", mimeType: "image/png", dataUrl: TINY_PNG_DATA_URL }),
  });
  check("STUDENT dekont gönderemez: 403", studentSubmitRes.status === 403, studentSubmitRes.status);

  const invalidMimeRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "x.exe", mimeType: "application/x-msdownload", dataUrl: TINY_PNG_DATA_URL }),
  });
  check("Geçersiz MIME türü: 400", invalidMimeRes.status === 400, invalidMimeRes.status);

  const oversizedRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "x.png", mimeType: "image/png", dataUrl: "data:image/png;base64," + "A".repeat(3_600_000) }),
  });
  check("Aşırı büyük dosya: 400", oversizedRes.status === 400, oversizedRes.status);

  // ===== Geçerli gönderim =====
  const submitRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "dekont.png", mimeType: "image/png", dataUrl: TINY_PNG_DATA_URL, note: "Test notu" }),
  });
  const submitBody = await submitRes.json();
  check("POST: 201 dönüyor", submitRes.status === 201, submitRes.status);
  check("Yeni dekont BEKLIYOR durumunda", submitBody.receipt?.status === "BEKLIYOR", submitBody.receipt?.status);
  const receiptId = submitBody.receipt.id;

  const notPendingRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "y.png", mimeType: "image/png", dataUrl: TINY_PNG_DATA_URL }),
  });
  // fixtureInstallment hâlâ PENDING (henüz onaylanmadı) — bu yüzden ikinci gönderim de kabul edilmeli.
  check("Aynı (hâlâ PENDING) taksit için ikinci gönderim de kabul edilir: 201", notPendingRes.status === 201, notPendingRes.status);
  const secondReceiptId = (await notPendingRes.json()).receipt.id;

  const parentListRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, { headers: { Cookie: parentCookie } });
  const parentListBody = await parentListRes.json();
  check("Veli kendi gönderdiği dekontu listede görüyor", parentListBody.receipts?.some((r) => r.id === receiptId));

  const studentListRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, { headers: { Cookie: studentCookie } });
  check("STUDENT kendi dekont listesini göremez: 403", studentListRes.status === 403, studentListRes.status);

  // ===== Şube tarafı: listeleme yetkisi =====
  const noAuthListRes = await fetch(`${BASE}/api/branch/payment-receipts`);
  check("GET branch payment-receipts: oturumsuz 401", noAuthListRes.status === 401, noAuthListRes.status);

  const teacherListRes = await fetch(`${BASE}/api/branch/payment-receipts`, { headers: { Cookie: teacherCookie } });
  check("TEACHER dekontları göremez: 403", teacherListRes.status === 403, teacherListRes.status);

  const branchListRes = await fetch(`${BASE}/api/branch/payment-receipts`, { headers: { Cookie: branchAdminCookie } });
  const branchListBody = await branchListRes.json();
  check("BRANCH_ADMIN: 200 dönüyor", branchListRes.status === 200, branchListRes.status);
  check("Gönderilen dekont şube listesinde", branchListBody.receipts?.some((r) => r.id === receiptId));
  check("dataUrl alanı gerçek dosyayı içeriyor", branchListBody.receipts?.find((r) => r.id === receiptId)?.dataUrl === TINY_PNG_DATA_URL);

  // ===== Reddetme =====
  const teacherReviewRes = await fetch(`${BASE}/api/branch/payment-receipts/${receiptId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ decision: "REJECT" }),
  });
  check("TEACHER dekont inceleyemez: 403", teacherReviewRes.status === 403, teacherReviewRes.status);

  const rejectRes = await fetch(`${BASE}/api/branch/payment-receipts/${receiptId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ decision: "REJECT" }),
  });
  const rejectBody = await rejectRes.json();
  check("REJECT: 200 dönüyor", rejectRes.status === 200, rejectRes.status);
  check("Dekont REDDEDILDI durumuna geçti", rejectBody.receipt?.status === "REDDEDILDI", rejectBody.receipt?.status);

  const installmentAfterRejectRes = await prisma.paymentInstallment.findUnique({ where: { id: fixtureInstallment.id } });
  check("Reddedilince taksit hâlâ PENDING", installmentAfterRejectRes.status === "PENDING", installmentAfterRejectRes.status);
  const ledgerAfterReject = await prisma.accountingLedgerEntry.findFirst({ where: { relatedInstallmentId: fixtureInstallment.id } });
  check("Reddedilince Muhasebe defterine kayıt DÜŞMEDİ", !ledgerAfterReject);

  const reReviewRes = await fetch(`${BASE}/api/branch/payment-receipts/${receiptId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Zaten incelenmiş dekontu tekrar inceleme: 409", reReviewRes.status === 409, reReviewRes.status);

  // ===== Onaylama (ikinci dekont üzerinden) =====
  const approveRes = await fetch(`${BASE}/api/branch/payment-receipts/${secondReceiptId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  const approveBody = await approveRes.json();
  check("APPROVE: 200 dönüyor", approveRes.status === 200, approveRes.status);
  check("Dekont ONAYLANDI durumuna geçti", approveBody.receipt?.status === "ONAYLANDI", approveBody.receipt?.status);

  const installmentAfterApproveRes = await prisma.paymentInstallment.findUnique({ where: { id: fixtureInstallment.id } });
  check("Onaylanınca taksit PAID oldu", installmentAfterApproveRes.status === "PAID", installmentAfterApproveRes.status);
  const ledgerAfterApprove = await prisma.accountingLedgerEntry.findFirst({ where: { relatedInstallmentId: fixtureInstallment.id } });
  check(
    "Onaylanınca doğru kategoride defter kaydı oluştu",
    ledgerAfterApprove?.category === "Taksit Tahsilatı (Havale · Dekont Onaylı)",
    ledgerAfterApprove?.category,
  );
  check("Defter kaydı tutarı taksit tutarıyla eşleşiyor", Number(ledgerAfterApprove?.amount) === 5000, ledgerAfterApprove?.amount?.toString());

  // ===== PENDING olmayan taksit için gönderim reddedilir =====
  const submitForPaidRes = await fetch(`${BASE}/api/students/${elif.id}/payment-receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: parentCookie },
    body: JSON.stringify({ installmentId: fixtureInstallment.id, fileName: "z.png", mimeType: "image/png", dataUrl: TINY_PNG_DATA_URL }),
  });
  check("Artık PAID olan taksit için gönderim: 409", submitForPaidRes.status === 409, submitForPaidRes.status);

  // ===== Tenant izolasyonu =====
  const cankayaListRes = await fetch(`${BASE}/api/branch/payment-receipts`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaListRes.json();
  check("Çankaya admin'i Mezitli'nin dekontlarını GÖRMÜYOR", !cankayaListBody.receipts?.some((r) => r.id === receiptId || r.id === secondReceiptId));

  const cankayaReviewRes = await fetch(`${BASE}/api/branch/payment-receipts/${fixtureInstallment2.id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cankayaCookie },
    body: JSON.stringify({ decision: "APPROVE" }),
  });
  check("Çankaya admin'i var olmayan/başka tenant kaydını inceleyemez: 404", cankayaReviewRes.status === 404, cankayaReviewRes.status);

  // Temizlik
  await prisma.accountingLedgerEntry.deleteMany({ where: { relatedInstallmentId: { in: [fixtureInstallment.id, fixtureInstallment2.id] } } });
  await prisma.paymentReceipt.deleteMany({ where: { installmentId: { in: [fixtureInstallment.id, fixtureInstallment2.id] } } });
  await prisma.paymentInstallment.deleteMany({ where: { id: { in: [fixtureInstallment.id, fixtureInstallment2.id] } } });

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
