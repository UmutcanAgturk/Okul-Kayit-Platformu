// Günlük Operasyon Paneli modülünün GERÇEK bir Postgres veritabanına karşı
// uçtan uca doğrulaması. Önkoşullar: kökte `npm run seed` çalıştırılmış,
// `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı. Yeni bir Prisma
// modeli EKLEMEZ — mevcut PaymentInstallment ve StudySession verisini
// birleştirir (bkz. app/api/branch/daily-ops).
//
// Seed verisi "bugüne göre" gecikmiş/yaklaşan taksit veya bugünkü etüt
// içermediğinden (seed sabit bir geçmiş tarihte oluşturuldu), bu test kendi
// throwaway fixture'larını (1 gecikmiş taksit, 1 yaklaşan taksit, 1 bugünkü
// StudySession) oluşturur ve sonunda temizler.
//
// Kontrol ettikleri: yetki (BRANCH_ADMIN/ACCOUNTING görebiliyor, TEACHER
// 403), gecikmiş/yaklaşan taksitlerin doğru ayrıştırıldığı, "Tahsil Et"
// butonunun gerçekten mevcut /collect endpoint'ini çağırdığı (tahsil edilen
// taksit bir daha listede görünmüyor), bugünkü etüt doluluğunun ders+saat
// bazında doğru gruplandığı.
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
  const elif = await prisma.studentProfile.findFirst({ where: { user: { email: "elif.yilmaz@ogrenci.seviye360.com" } } });
  const ahmetTeacher = await prisma.teacherProfile.findFirst({ where: { user: { email: "ayse.demir@seviye360.com" } } });
  const achievement = await prisma.curriculumNode.findFirst({ where: { code: "MAT.9.1.2.3" } });
  if (!mezitli || !elif || !ahmetTeacher || !achievement) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: BRANCH_ADMIN/TEACHER için giriş başarılı", !!branchAdminCookie && !!teacherCookie);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 2 * 86400000);
  const in3Days = new Date(now.getTime() + 3 * 86400000);
  const todayNoon = new Date(`${now.toISOString().slice(0, 10)}T12:00:00.000Z`);

  const overdueInstallment = await prisma.paymentInstallment.create({
    data: { tenantId: mezitli.id, studentId: elif.id, installmentNo: 901, amount: 5000, dueDate: yesterday, status: "PENDING" },
  });
  const upcomingInstallment = await prisma.paymentInstallment.create({
    data: { tenantId: mezitli.id, studentId: elif.id, installmentNo: 902, amount: 3000, dueDate: in3Days, status: "PENDING" },
  });
  const studySession = await prisma.studySession.create({
    data: {
      tenantId: mezitli.id,
      studentId: elif.id,
      teacherId: ahmetTeacher.id,
      achievementId: achievement.id,
      status: "TEACHER_APPROVED",
      source: "MANUAL",
      scheduledStart: todayNoon,
      scheduledEnd: new Date(todayNoon.getTime() + 45 * 60000),
    },
  });

  try {
    const noAuthRes = await fetch(`${BASE}/api/branch/daily-ops`);
    check("GET daily-ops: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

    const teacherRes = await fetch(`${BASE}/api/branch/daily-ops`, { headers: { Cookie: teacherCookie } });
    check("TEACHER görüntüleyemez: 403", teacherRes.status === 403, teacherRes.status);

    const opsRes = await fetch(`${BASE}/api/branch/daily-ops`, { headers: { Cookie: branchAdminCookie } });
    const opsBody = await opsRes.json();
    check("BRANCH_ADMIN görüntüler: 200", opsRes.status === 200, opsRes.status);

    check(
      "Gecikmiş taksit listede + doğru gün sayısı",
      opsBody.overduePayments?.some((r) => r.installmentId === overdueInstallment.id && r.daysLate === 2),
      JSON.stringify(opsBody.overduePayments?.find((r) => r.installmentId === overdueInstallment.id)),
    );
    check(
      "Yaklaşan taksit listede",
      opsBody.upcomingPayments?.some((r) => r.installmentId === upcomingInstallment.id),
    );
    check(
      "overdueTotal, gecikmiş taksit tutarlarının toplamını içeriyor",
      opsBody.overdueTotal >= 5000,
      opsBody.overdueTotal,
    );
    check(
      "Bugünkü etüt: Matematik slotu doğru sayıda",
      opsBody.todayEtut?.some((s) => s.subject === "Matematik" && s.time === "12:00" && s.count >= 1),
      JSON.stringify(opsBody.todayEtut),
    );
    check("todayEtutTotal en az 1", opsBody.todayEtutTotal >= 1, opsBody.todayEtutTotal);

    // ===== Tahsil Et: gecikmiş taksiti tahsil et, listeden düşmeli =====
    const collectRes = await fetch(`${BASE}/api/branch/payment-installments/${overdueInstallment.id}/collect`, {
      method: "POST",
      headers: { Cookie: branchAdminCookie },
    });
    check("Tahsil Et: 200", collectRes.status === 200, collectRes.status);

    const afterCollectRes = await fetch(`${BASE}/api/branch/daily-ops`, { headers: { Cookie: branchAdminCookie } });
    const afterCollectBody = await afterCollectRes.json();
    check(
      "Tahsil edilen taksit artık gecikmiş listede yok",
      !afterCollectBody.overduePayments?.some((r) => r.installmentId === overdueInstallment.id),
    );
  } finally {
    // Temizlik — yalnızca bu testin oluşturduğu fixture'lar.
    await prisma.accountingLedgerEntry.deleteMany({ where: { relatedInstallmentId: overdueInstallment.id } });
    await prisma.studySession.delete({ where: { id: studySession.id } }).catch(() => {});
    await prisma.paymentInstallment.deleteMany({ where: { id: { in: [overdueInstallment.id, upcomingInstallment.id] } } });
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
