// Belgeler modülünün (Fatura/Dekont/Senet) GERÇEK bir Postgres veritabanına
// karşı uçtan uca doğrulaması. Önkoşullar: `npx prisma migrate deploy`
// (documents migration'ı) uygulanmış, kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri:
//   1. Invoice: yetki/doğrulama/oluşturma/silme, KDV hesabı (istisna vs oranlı),
//      belge no formatı, tenant izolasyonu.
//   2. Receipt: yetki/doğrulama/oluşturma/silme, tenant izolasyonu.
//   3. PromissoryNote: yetki/doğrulama/oluşturma/silme, mark-paid (idempotent
//      değil — ikinci çağrı 409), tenant izolasyonu, opsiyonel studentId.
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

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: üç rol için de giriş başarılı", !!branchAdminCookie && !!teacherCookie && !!cankayaCookie);

  // ===================== INVOICE (Fatura) =====================
  const noSessionInv = await fetch(`${BASE}/api/branch/invoices`);
  check("GET invoices: oturum yoksa 401 dönüyor", noSessionInv.status === 401, noSessionInv.status);

  const teacherInv = await fetch(`${BASE}/api/branch/invoices`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER rolü faturaları göremiyor (403)", teacherInv.status === 403, teacherInv.status);

  const invalidInvoice = await fetch(`${BASE}/api/branch/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ invoiceDate: "2026-07-01", buyerName: "", items: [] }),
  });
  check("POST invoices: geçersiz gövde 400 dönüyor", invalidInvoice.status === 400, invalidInvoice.status);

  const exemptInvoiceRes = await fetch(`${BASE}/api/branch/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      invoiceDate: "2026-07-01",
      buyerName: "Test Veli A.Ş.",
      buyerTaxNo: "1234567890",
      items: [{ description: "Eğitim Hizmeti", quantity: 1, unitPrice: 10000 }],
      kdvExempt: true,
    }),
  });
  const exemptInvoiceBody = await exemptInvoiceRes.json();
  check("POST invoices: KDV istisnalı fatura 201 dönüyor", exemptInvoiceRes.status === 201, exemptInvoiceRes.status);
  check(
    "Hesap: KDV istisnalı faturada kdvAmount=0, total=subtotal",
    Number(exemptInvoiceBody.invoice?.kdvAmount) === 0 && Number(exemptInvoiceBody.invoice?.total) === 10000,
    JSON.stringify(exemptInvoiceBody.invoice),
  );
  check("Belge no formatı: FT-YYYY-NNNNNN", /^FT-\d{4}-\d{6}$/.test(exemptInvoiceBody.invoice?.no ?? ""), exemptInvoiceBody.invoice?.no);

  const ratedInvoiceRes = await fetch(`${BASE}/api/branch/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      invoiceDate: "2026-07-02",
      buyerName: "Test Şirket Ltd.",
      items: [
        { description: "Kırtasiye", quantity: 2, unitPrice: 100 },
        { description: "Servis", quantity: 1, unitPrice: 300 },
      ],
      kdvExempt: false,
      kdvRate: 0.2,
    }),
  });
  const ratedInvoiceBody = await ratedInvoiceRes.json();
  check(
    "Hesap: %20 KDV'li faturada subtotal=500, kdvAmount=100, total=600",
    Number(ratedInvoiceBody.invoice?.subtotal) === 500 &&
      Number(ratedInvoiceBody.invoice?.kdvAmount) === 100 &&
      Number(ratedInvoiceBody.invoice?.total) === 600,
    JSON.stringify(ratedInvoiceBody.invoice),
  );

  const cankayaInvoices = await fetch(`${BASE}/api/branch/invoices`, { headers: { Cookie: cankayaCookie } });
  const cankayaInvoicesBody = await cankayaInvoices.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin faturalarını GÖREMİYOR",
    !cankayaInvoicesBody.invoices?.some((i) => i.id === exemptInvoiceBody.invoice.id),
  );

  const cankayaDeleteInvoice = await fetch(`${BASE}/api/branch/invoices/${exemptInvoiceBody.invoice.id}`, {
    method: "DELETE",
    headers: { Cookie: cankayaCookie },
  });
  check("Tenant izolasyonu: Çankaya faturayı silemiyor (404)", cankayaDeleteInvoice.status === 404, cankayaDeleteInvoice.status);

  const teacherDeleteInvoice = await fetch(`${BASE}/api/branch/invoices/${exemptInvoiceBody.invoice.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Yetki: TEACHER rolü fatura silemiyor (403)", teacherDeleteInvoice.status === 403, teacherDeleteInvoice.status);

  const deleteInvoiceRes = await fetch(`${BASE}/api/branch/invoices/${exemptInvoiceBody.invoice.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE invoices: yetkili şube yöneticisi 200 alıyor", deleteInvoiceRes.status === 200, deleteInvoiceRes.status);
  const dbInvoiceAfter = await prisma.invoice.findUnique({ where: { id: exemptInvoiceBody.invoice.id } });
  check("DB: fatura gerçekten silindi", dbInvoiceAfter === null);

  // ===================== RECEIPT (Dekont) =====================
  const invalidReceipt = await fetch(`${BASE}/api/branch/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ receiptDate: "2026-07-01", type: "GECERSIZ", personName: "", amount: -5 }),
  });
  check("POST receipts: geçersiz gövde 400 dönüyor", invalidReceipt.status === 400, invalidReceipt.status);

  const receiptRes = await fetch(`${BASE}/api/branch/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      receiptDate: "2026-07-05",
      type: "TAHSILAT",
      personName: "Test Veli B",
      amount: 2500,
      method: "NAKIT",
    }),
  });
  const receiptBody = await receiptRes.json();
  check("POST receipts: 201 dönüyor", receiptRes.status === 201, receiptRes.status);
  check("Belge no formatı: DKN-YYYY-NNNNNN", /^DKN-\d{4}-\d{6}$/.test(receiptBody.receipt?.no ?? ""), receiptBody.receipt?.no);

  const cankayaReceipts = await fetch(`${BASE}/api/branch/receipts`, { headers: { Cookie: cankayaCookie } });
  const cankayaReceiptsBody = await cankayaReceipts.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin dekontlarını GÖREMİYOR",
    !cankayaReceiptsBody.receipts?.some((r) => r.id === receiptBody.receipt.id),
  );

  const deleteReceiptRes = await fetch(`${BASE}/api/branch/receipts/${receiptBody.receipt.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE receipts: yetkili şube yöneticisi 200 alıyor", deleteReceiptRes.status === 200, deleteReceiptRes.status);
  const dbReceiptAfter = await prisma.receipt.findUnique({ where: { id: receiptBody.receipt.id } });
  check("DB: dekont gerçekten silindi", dbReceiptAfter === null);

  // ===================== PROMISSORY NOTE (Senet) =====================
  const invalidNote = await fetch(`${BASE}/api/branch/promissory-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ issueDate: "2026-07-01", dueDate: "2026-08-01", debtorName: "", amount: -1 }),
  });
  check("POST promissory-notes: geçersiz gövde 400 dönüyor", invalidNote.status === 400, invalidNote.status);

  const noteRes = await fetch(`${BASE}/api/branch/promissory-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ issueDate: "2026-07-10", dueDate: "2026-08-10", debtorName: "Test Borçlu", amount: 5000 }),
  });
  const noteBody = await noteRes.json();
  check("POST promissory-notes: 201 dönüyor", noteRes.status === 201, noteRes.status);
  check("Belge no formatı: SNT-YYYY-NNNNNN", /^SNT-\d{4}-\d{6}$/.test(noteBody.promissoryNote?.no ?? ""), noteBody.promissoryNote?.no);
  check("Başlangıç durumu: ODENMEDI", noteBody.promissoryNote?.status === "ODENMEDI");

  const teacherMarkPaid = await fetch(`${BASE}/api/branch/promissory-notes/${noteBody.promissoryNote.id}/mark-paid`, {
    method: "POST",
    headers: { Cookie: teacherCookie },
  });
  check("Yetki: TEACHER rolü senedi ödendi işaretleyemiyor (403)", teacherMarkPaid.status === 403, teacherMarkPaid.status);

  const markPaidRes = await fetch(`${BASE}/api/branch/promissory-notes/${noteBody.promissoryNote.id}/mark-paid`, {
    method: "POST",
    headers: { Cookie: branchAdminCookie },
  });
  const markPaidBody = await markPaidRes.json();
  check("POST mark-paid: 200 dönüyor ve status ODENDI oluyor", markPaidRes.status === 200 && markPaidBody.promissoryNote?.status === "ODENDI");
  check("POST mark-paid: paidAt dolduruluyor", !!markPaidBody.promissoryNote?.paidAt);

  const markPaidAgainRes = await fetch(`${BASE}/api/branch/promissory-notes/${noteBody.promissoryNote.id}/mark-paid`, {
    method: "POST",
    headers: { Cookie: branchAdminCookie },
  });
  check("POST mark-paid: zaten ödenmiş senet için 409 dönüyor", markPaidAgainRes.status === 409, markPaidAgainRes.status);

  const cankayaNotes = await fetch(`${BASE}/api/branch/promissory-notes`, { headers: { Cookie: cankayaCookie } });
  const cankayaNotesBody = await cankayaNotes.json();
  check(
    "Tenant izolasyonu: Çankaya yöneticisi Mezitli'nin senetlerini GÖREMİYOR",
    !cankayaNotesBody.notes?.some((n) => n.id === noteBody.promissoryNote.id),
  );

  const cankayaDeleteNote = await fetch(`${BASE}/api/branch/promissory-notes/${noteBody.promissoryNote.id}`, {
    method: "DELETE",
    headers: { Cookie: cankayaCookie },
  });
  check("Tenant izolasyonu: Çankaya senedi silemiyor (404)", cankayaDeleteNote.status === 404, cankayaDeleteNote.status);

  const deleteNoteRes = await fetch(`${BASE}/api/branch/promissory-notes/${noteBody.promissoryNote.id}`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE promissory-notes: yetkili şube yöneticisi 200 alıyor", deleteNoteRes.status === 200, deleteNoteRes.status);
  const dbNoteAfter = await prisma.promissoryNote.findUnique({ where: { id: noteBody.promissoryNote.id } });
  check("DB: senet gerçekten silindi", dbNoteAfter === null);

  const missingNoteDelete = await fetch(`${BASE}/api/branch/promissory-notes/does-not-exist`, {
    method: "DELETE",
    headers: { Cookie: branchAdminCookie },
  });
  check("DELETE promissory-notes: olmayan id için 404 dönüyor", missingNoteDelete.status === 404, missingNoteDelete.status);

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
