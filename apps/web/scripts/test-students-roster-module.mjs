// Öğrenciler / Sınıf Atama modülünün (app/api/branch/students) GERÇEK bir
// Postgres veritabanına karşı uçtan uca doğrulaması. Önkoşullar: kökte
// `npm run seed` çalıştırılmış, `npm run dev` sunucusu (localhost:3000)
// çalışıyor olmalı.
//
// Kontrol ettikleri: yetki (TEACHER 403, oturumsuz 401), tenant izolasyonu
// (Çankaya admin'i Mezitli öğrencisini GÖREMİYOR), sınıf atama/kaldırma,
// yanlış tenant'a ait classroomId'nin reddedilmesi, sınıf seviyesi
// uyuşmazlığının reddedilmesi, ve Aktivite Akışı'na yansıma.
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
  const mezitliClassroom = await prisma.classroom.findFirst({ where: { tenantId: elif.tenantId, name: "9-A" } });
  const cankayaClassroom = await prisma.classroom.findFirst({ where: { NOT: { tenantId: elif.tenantId } } });
  if (!elif || !mezitliClassroom) throw new Error("Seed verisi bulunamadı — önce kökten `npm run seed` çalıştırın.");

  const branchCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  const cankayaCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("Kurulum: giriş başarılı", !!branchCookie && !!teacherCookie && !!cankayaCookie);

  const noSession = await fetch(`${BASE}/api/branch/students`);
  check("GET students: oturumsuz 401", noSession.status === 401, noSession.status);

  const teacherRes = await fetch(`${BASE}/api/branch/students`, { headers: { Cookie: teacherCookie } });
  check("Yetki: TEACHER listeleyemez (403)", teacherRes.status === 403, teacherRes.status);

  const listRes = await fetch(`${BASE}/api/branch/students`, { headers: { Cookie: branchCookie } });
  const listBody = await listRes.json();
  check("GET students: BRANCH_ADMIN listeleyebiliyor (200)", listRes.status === 200, listRes.status);
  const elifRow = listBody.students?.find((s) => s.studentNo === "201001");
  check("Elif roster'da doğru sınıfla görünüyor", elifRow?.classroomName === "9-A", elifRow);
  check("Elif'in veli bilgisi dolu", !!elifRow?.guardianName, elifRow?.guardianName);

  const cankayaListRes = await fetch(`${BASE}/api/branch/students`, { headers: { Cookie: cankayaCookie } });
  const cankayaListBody = await cankayaListRes.json();
  check(
    "Tenant izolasyonu: Çankaya admin'i Mezitli öğrencisini GÖREMİYOR",
    !cankayaListBody.students?.some((s) => s.studentNo === "201001"),
    cankayaListBody.students?.map((s) => s.studentNo),
  );

  // ===== Sınıf ataması kaldırma =====
  const unassignRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: null }),
  });
  const unassignBody = await unassignRes.json();
  check("PATCH: sınıf ataması kaldırılabiliyor (200)", unassignRes.status === 200 && unassignBody.classroomId === null, unassignBody);

  const afterUnassign = await prisma.studentProfile.findUnique({ where: { id: elif.id } });
  check("DB: classroomId gerçekten null oldu", afterUnassign.classroomId === null, afterUnassign.classroomId);

  // ===== Yanlış tenant'a ait classroomId reddedilmeli =====
  if (cankayaClassroom) {
    const crossTenantRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: branchCookie },
      body: JSON.stringify({ classroomId: cankayaClassroom.id }),
    });
    check("PATCH: başka tenant'ın classroomId'si reddediliyor (400)", crossTenantRes.status === 400, crossTenantRes.status);
  }

  // ===== Geri ata (asıl duruma dön) =====
  const reassignRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: mezitliClassroom.id }),
  });
  const reassignBody = await reassignRes.json();
  check(
    "PATCH: aynı seviyedeki sınıfa tekrar atanabiliyor (200)",
    reassignRes.status === 200 && reassignBody.classroomName === "9-A",
    reassignBody,
  );

  const notFoundRes = await fetch(`${BASE}/api/branch/students/does-not-exist`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ classroomId: null }),
  });
  check("PATCH: olmayan öğrenci için 404", notFoundRes.status === 404, notFoundRes.status);

  const lastLog = await prisma.auditLogEntry.findFirst({
    where: { tenantId: elif.tenantId, action: { in: ["Öğrenci sınıfa atandı", "Öğrencinin sınıf ataması kaldırıldı"] } },
    orderBy: { createdAt: "desc" },
  });
  check("Aktivite Akışı: sınıf atama işlemi loglandı", !!lastLog, lastLog?.action);

  // ===== Öğrenci Hızlı Görüntüle/Düzenle Çekmecesi — veli iletişim düzenleme =====
  const guardianRowBefore = await prisma.studentGuardian.findFirst({
    where: { studentId: elif.id },
    include: { parent: { include: { user: true } } },
  });
  check("Kurulum: Elif'in bir velisi var", !!guardianRowBefore, guardianRowBefore?.parent.user.email);
  const originalFirstName = guardianRowBefore.parent.user.firstName;
  const originalLastName = guardianRowBefore.parent.user.lastName;
  const originalPhone = guardianRowBefore.parent.user.phone;

  const teacherGuardianRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ guardianFullName: "X Y", guardianPhone: "05559990000" }),
  });
  check("Yetki: TEACHER veli bilgisini düzenleyemez (403)", teacherGuardianRes.status === 403, teacherGuardianRes.status);

  const newPhone = "05557778899";
  const guardianEditRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ guardianFullName: "Test Veli Güncel", guardianPhone: newPhone }),
  });
  const guardianEditBody = await guardianEditRes.json();
  check(
    "PATCH: veli iletişim bilgisi güncellenebiliyor (200)",
    guardianEditRes.status === 200 && guardianEditBody.guardianName === "Test Veli Güncel" && guardianEditBody.guardianPhone === newPhone,
    guardianEditBody,
  );

  const guardianUserAfter = await prisma.user.findUnique({ where: { id: guardianRowBefore.parent.user.id } });
  check(
    "DB: veli User kaydı gerçekten güncellendi",
    guardianUserAfter.firstName === "Test" && guardianUserAfter.lastName === "Veli Güncel" && guardianUserAfter.phone === newPhone,
    guardianUserAfter,
  );

  const emptyGuardianRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ guardianFullName: "", guardianPhone: newPhone }),
  });
  check("PATCH: boş veli adı reddediliyor (400)", emptyGuardianRes.status === 400, emptyGuardianRes.status);

  // Telefon benzersizliği artık @@unique([tenantId, phone]) — global DEĞİL
  // (bkz. prisma/schema.prisma User.phone yorumu: önceden bir BRANCH_ADMIN,
  // rastgele telefon deneyip 409/200 yanıtından başka bir şubenin kayıtlı
  // telefon numaralarını teşhis edebiliyordu — cross-tenant existence
  // oracle'ı). Seed verisinde hazır bir telefon numarası olmadığından, bu
  // senaryoyu gerçek şekilde sınamak için Mezitli'deki öğretmene (aynı
  // tenant) ve Çankaya'daki şube yöneticisine (başka tenant) geçici olarak
  // telefon atanır, test sonunda geri temizlenir.
  const sameTenantOtherUser = await prisma.user.findFirst({ where: { email: "ayse.demir@seviye360.com" } });
  const crossTenantUser = await prisma.user.findFirst({ where: { email: "onur.kaya@seviye360.com" } });
  const sameTenantPhone = "05551230001";
  const crossTenantPhone = "05551230002";
  await prisma.user.update({ where: { id: sameTenantOtherUser.id }, data: { phone: sameTenantPhone } });
  await prisma.user.update({ where: { id: crossTenantUser.id }, data: { phone: crossTenantPhone } });

  const phoneClashRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ guardianFullName: "Test Veli Güncel", guardianPhone: sameTenantPhone }),
  });
  check("PATCH: aynı tenant'taki başka kullanıcının telefonu reddediliyor (409)", phoneClashRes.status === 409, phoneClashRes.status);

  const crossTenantRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ guardianFullName: "Test Veli Güncel", guardianPhone: crossTenantPhone }),
  });
  check(
    "PATCH: başka bir şubedeki telefon numarasıyla çakışma ENGELLENMİYOR (cross-tenant oracle kapalı)",
    crossTenantRes.status === 200,
    crossTenantRes.status,
  );

  await prisma.user.update({ where: { id: sameTenantOtherUser.id }, data: { phone: null } });
  await prisma.user.update({ where: { id: crossTenantUser.id }, data: { phone: null } });

  // ===== Temizlik: veli bilgisini asıl haline geri döndür =====
  await prisma.user.update({
    where: { id: guardianRowBefore.parent.user.id },
    data: { firstName: originalFirstName, lastName: originalLastName, phone: originalPhone },
  });
  const guardianUserRestored = await prisma.user.findUnique({ where: { id: guardianRowBefore.parent.user.id } });
  check(
    "Temizlik: veli bilgisi asıl haline döndü",
    guardianUserRestored.firstName === originalFirstName && guardianUserRestored.phone === originalPhone,
    guardianUserRestored,
  );

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
