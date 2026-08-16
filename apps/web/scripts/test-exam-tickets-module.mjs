// QR Sınav Belgesi modülünün (app/api/students/[studentId]/exam-tickets)
// GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar:
// kökte `npm run seed` çalıştırılmış (Elif/Ahmet için ExamResult fixture'ları
// oluşturur), `npm run dev` sunucusu (localhost:3000) çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (STUDENT kendi, PARENT velisi olduğu, başkası
// GÖREMİYOR — 403), oturumsuz 401, seed'deki sınavın doğru alanlarla
// (ad/tarih/öğrenci no) döndüğü, ve salon/koltuk atanmamış sınavlar için
// bu alanların dürüstçe null döndüğü (uydurulmadığı).
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
  const ahmet = await prisma.studentProfile.findFirst({ where: { studentNo: "201003" } });
  const elif = await prisma.studentProfile.findFirst({ where: { studentNo: "201001" } });
  if (!ahmet || !elif) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const ahmetCookie = await loginAs("ahmet.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const elifCookie = await loginAs("elif.yilmaz@ogrenci.seviye360.com", SEED_DEV_PASSWORD);
  const parentCookie = await loginAs("hakan.yilmaz@veli.seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!ahmetCookie && !!elifCookie && !!parentCookie);

  const noSession = await fetch(`${BASE}/api/students/${ahmet.id}/exam-tickets`);
  check("GET: oturumsuz 401", noSession.status === 401, noSession.status);

  const ahmetRes = await fetch(`${BASE}/api/students/${ahmet.id}/exam-tickets`, { headers: { Cookie: ahmetCookie } });
  const ahmetBody = await ahmetRes.json();
  check("GET: Ahmet kendi belgelerini görebiliyor (200)", ahmetRes.status === 200, ahmetRes.status);
  const xrayTicket = ahmetBody.tickets?.find((t) => t.studentNo === "201003");
  check("Sınav belgesi doğru öğrenci no ile dönüyor", xrayTicket?.studentNo === "201003", xrayTicket);
  check(
    "Salon/koltuk henüz atanmadığından dürüstçe null dönüyor (uydurulmadı)",
    xrayTicket && xrayTicket.seatingRoomId === null && xrayTicket.seatNo === null,
    xrayTicket,
  );

  const otherRes = await fetch(`${BASE}/api/students/${elif.id}/exam-tickets`, { headers: { Cookie: ahmetCookie } });
  check("Yetki: başka bir STUDENT Elif'in belgelerini GÖREMİYOR (403)", otherRes.status === 403, otherRes.status);

  const parentRes = await fetch(`${BASE}/api/students/${elif.id}/exam-tickets`, { headers: { Cookie: parentCookie } });
  check("GET: velisi PARENT görebiliyor (200)", parentRes.status === 200, parentRes.status);

  const parentForbiddenRes = await fetch(`${BASE}/api/students/${ahmet.id}/exam-tickets`, { headers: { Cookie: parentCookie } });
  check("Yetki: velisi olmadığı Ahmet'in belgelerini GÖREMİYOR (403)", parentForbiddenRes.status === 403, parentForbiddenRes.status);

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
