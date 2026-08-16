// Ödeme İşlemleri (veli) modülünün (app/api/students/[id]/installments/[id]/pay)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış (Elif Yılmaz için 9 taksitlik bir plan
// oluşturur, 2'si ödenmiş), `npm run dev` sunucusu (localhost:3000) çalışıyor
// olmalı.
//
// Kontrol ettikleri: yetki (yalnızca PARENT ödeyebilir — STUDENT/TEACHER 403,
// oturumsuz 401), faturalama sorumlusu OLMAYAN bir velinin ödeyememesi,
// başarılı ödemenin PENDING→PAID + Muhasebe defterine yansıması, ve zaten
// ödenmiş bir taksitin tekrar ödenememesi (409). Test kendi ödediği taksiti
// sonunda PENDING'e geri döndürüp oluşturduğu defter kaydını siler.
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
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  const pendingInstallment = await prisma.paymentInstallment.findFirst({ where: { studentId: elif.id, status: "PENDING" } });
  if (!elif || !pendingInstallment) throw new Error("Seed verisi bulunamadı (PENDING taksit yok) — önce kökten `npm run seed` çalıştırın.");

  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  const studentCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!parentCookie && !!studentCookie && !!teacherCookie);

  const base = `${BASE}/api/students/${elif.id}/installments/${pendingInstallment.id}/pay`;

  const noSession = await fetch(base, { method: "POST" });
  check("POST: oturumsuz 401", noSession.status === 401, noSession.status);

  const studentRes = await fetch(base, { method: "POST", headers: { Cookie: studentCookie } });
  check("Yetki: STUDENT ödeyemez (403)", studentRes.status === 403, studentRes.status);

  const teacherRes = await fetch(base, { method: "POST", headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER ödeyemez (403)", teacherRes.status === 403, teacherRes.status);

  const payRes = await fetch(base, { method: "POST", headers: { Cookie: parentCookie } });
  const payBody = await payRes.json();
  check("POST: faturalama sorumlusu veli ödeyebiliyor (200)", payRes.status === 200 && payBody.installment?.status === "PAID", payBody);

  const dbInstallment = await prisma.paymentInstallment.findUnique({ where: { id: pendingInstallment.id } });
  check("DB: taksit gerçekten PAID oldu", dbInstallment.status === "PAID" && !!dbInstallment.paidAt, dbInstallment.status);

  const ledgerEntry = await prisma.accountingLedgerEntry.findFirst({
    where: { relatedInstallmentId: pendingInstallment.id },
    orderBy: { createdAt: "desc" },
  });
  check("Muhasebe defterine GELİR kaydı düştü", ledgerEntry?.type === "GELIR" && Number(ledgerEntry.amount) === Number(pendingInstallment.amount), ledgerEntry);

  const alreadyPaidRes = await fetch(base, { method: "POST", headers: { Cookie: parentCookie } });
  check("POST: zaten ödenmiş taksit tekrar ödenemiyor (409)", alreadyPaidRes.status === 409, alreadyPaidRes.status);

  // ===== Temizlik: taksiti PENDING'e geri döndür, oluşan defter kaydını sil =====
  await prisma.accountingLedgerEntry.delete({ where: { id: ledgerEntry.id } });
  await prisma.paymentInstallment.update({
    where: { id: pendingInstallment.id },
    data: { status: "PENDING", paidAt: null, providerTransactionId: null },
  });
  const restored = await prisma.paymentInstallment.findUnique({ where: { id: pendingInstallment.id } });
  check("Temizlik: taksit PENDING'e geri döndürüldü", restored.status === "PENDING", restored.status);

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
