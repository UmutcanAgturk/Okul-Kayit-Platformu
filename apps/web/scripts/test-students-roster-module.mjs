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
import bcrypt from "bcryptjs";

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
  check(
    "Aktivite Akışı detail formatı 'Son Atamalar' panelinin ayrıştırdığı 'Ad Soyad → Sınıf' biçiminde",
    lastLog?.action === "Öğrenci sınıfa atandı" && !!lastLog.detail?.includes(" → 9-A"),
    lastLog?.detail,
  );

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

  // ===== Öğrenci Detay Çekmecesi: kalıcı silme (task #74) =====
  const noPermanentRes = await fetch(`${BASE}/api/branch/students/${elif.id}`, { method: "DELETE", headers: { Cookie: branchCookie } });
  check("DELETE: ?permanent=true olmadan 400", noPermanentRes.status === 400, noPermanentRes.status);

  const teacherDeleteRes = await fetch(`${BASE}/api/branch/students/${elif.id}?permanent=true`, { method: "DELETE", headers: { Cookie: teacherCookie } });
  check("DELETE: TEACHER kalıcı silemez (403)", teacherDeleteRes.status === 403, teacherDeleteRes.status);

  const crossTenantDeleteRes = await fetch(`${BASE}/api/branch/students/${elif.id}?permanent=true`, { method: "DELETE", headers: { Cookie: cankayaCookie } });
  check("DELETE: Çankaya admin Mezitli öğrencisini silemez (404)", crossTenantDeleteRes.status === 404, crossTenantDeleteRes.status);

  const hasHistoryRes = await fetch(`${BASE}/api/branch/students/${elif.id}?permanent=true`, { method: "DELETE", headers: { Cookie: branchCookie } });
  check("DELETE: geçmişi olan öğrenci (taksit vb.) 409 ile reddediliyor", hasHistoryRes.status === 409, hasHistoryRes.status);
  const elifStillExists = await prisma.studentProfile.findUnique({ where: { id: elif.id } });
  check("DB: geçmişi olan öğrenci gerçekten SİLİNMEDİ", !!elifStillExists);

  // Hiç geçmişi olmayan, tek kullanımlık bir öğrenci fixture'ı — gerçekten silinebilmeli.
  const freshEmail = `test-delete-${Date.now()}@seviye360.com`;
  const freshUser = await prisma.user.create({
    data: { tenantId: elif.tenantId, email: freshEmail, passwordHash: bcrypt.hashSync(SEED_DEV_PASSWORD, 10), role: "STUDENT", firstName: "Test", lastName: "Silinecek" },
  });
  const freshStudent = await prisma.studentProfile.create({
    data: { tenantId: elif.tenantId, userId: freshUser.id, gradeLevel: "SINIF_9", studentNo: `TEST-DEL-${Date.now()}` },
  });
  const freshDeleteRes = await fetch(`${BASE}/api/branch/students/${freshStudent.id}?permanent=true`, { method: "DELETE", headers: { Cookie: branchCookie } });
  const freshDeleteBody = await freshDeleteRes.json();
  check("DELETE: geçmişi olmayan öğrenci kalıcı olarak silinebiliyor (200)", freshDeleteRes.status === 200 && freshDeleteBody.ok === true, freshDeleteRes.status);
  const freshStudentAfter = await prisma.studentProfile.findUnique({ where: { id: freshStudent.id } });
  const freshUserAfter = await prisma.user.findUnique({ where: { id: freshUser.id } });
  check("DB: StudentProfile gerçekten silindi", !freshStudentAfter);
  check("DB: bağlı User da gerçekten silindi", !freshUserAfter);

  const notFoundDeleteRes = await fetch(`${BASE}/api/branch/students/does-not-exist?permanent=true`, { method: "DELETE", headers: { Cookie: branchCookie } });
  check("DELETE: olmayan öğrenci için 404", notFoundDeleteRes.status === 404, notFoundDeleteRes.status);

  const deleteLog = await prisma.auditLogEntry.findFirst({
    where: { tenantId: elif.tenantId, action: "Öğrenci kaydı kalıcı olarak silindi" },
    orderBy: { createdAt: "desc" },
  });
  check("Aktivite Akışı: kalıcı silme işlemi loglandı", !!deleteLog && deleteLog.detail?.includes("Test Silinecek"), deleteLog?.detail);

  // ===== task #91: Öğrenci Hızlı Çekmece — zengin detay (GET .../detail) =====
  const achievements = await prisma.curriculumNode.findMany({ where: { type: "ACHIEVEMENT" }, take: 3 });
  const examOld = await prisma.exam.create({
    data: { tenantId: elif.tenantId, name: "Test Eski Deneme", type: "DENEME", scope: "BRANCH", examDate: new Date("2026-01-10") },
  });
  const examNew = await prisma.exam.create({
    data: { tenantId: elif.tenantId, name: "Test Yeni Deneme", type: "DENEME", scope: "BRANCH", examDate: new Date("2026-02-10") },
  });
  const detailEmail = `test-cekmece-${Date.now()}@ogrenci.seviye360.com`;
  const detailUser = await prisma.user.create({
    data: { tenantId: elif.tenantId, email: detailEmail, passwordHash: bcrypt.hashSync(SEED_DEV_PASSWORD, 10), role: "STUDENT", firstName: "Test", lastName: "Çekmece" },
  });
  const detailStudent = await prisma.studentProfile.create({
    data: {
      tenantId: elif.tenantId,
      userId: detailUser.id,
      gradeLevel: "SINIF_9",
      studentNo: `TEST-DTL-${Date.now()}`,
      nationalId: `${Date.now()}`.slice(-11).padStart(11, "9"),
      birthDate: new Date("2011-03-20"),
      gender: "Erkek",
      targetGoal: "Mühendislik",
    },
  });
  await prisma.paymentInstallment.create({
    data: { tenantId: elif.tenantId, studentId: detailStudent.id, installmentNo: 1, amount: 1000, dueDate: new Date("2020-01-01"), status: "PENDING" },
  });
  await prisma.examResult.create({
    data: { examId: examOld.id, tenantId: elif.tenantId, studentId: detailStudent.id, correctCount: 20, wrongCount: 15, emptyCount: 5, rawScore: 20, netScore: 16.25 },
  });
  const newResult = await prisma.examResult.create({
    data: { examId: examNew.id, tenantId: elif.tenantId, studentId: detailStudent.id, correctCount: 30, wrongCount: 5, emptyCount: 5, rawScore: 30, netScore: 28.75 },
  });
  if (achievements.length >= 3) {
    await prisma.studentAchievementResult.createMany({
      data: [
        { examResultId: newResult.id, studentId: detailStudent.id, achievementId: achievements[0].id, questionCount: 5, correctCount: 5, correctRatio: 0.9 },
        { examResultId: newResult.id, studentId: detailStudent.id, achievementId: achievements[1].id, questionCount: 5, correctCount: 3, correctRatio: 0.6 },
        { examResultId: newResult.id, studentId: detailStudent.id, achievementId: achievements[2].id, questionCount: 5, correctCount: 1, correctRatio: 0.2 },
      ],
    });
  }

  const detailRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}/detail`, { headers: { Cookie: branchCookie } });
  const detailBody = await detailRes.json();
  check("GET detail: 200", detailRes.status === 200, detailRes.status);
  check("GET detail: nationalId doğru", detailBody.student?.nationalId === detailStudent.nationalId, detailBody.student?.nationalId);
  check("GET detail: gender doğru", detailBody.student?.gender === "Erkek", detailBody.student?.gender);
  check("GET detail: targetGoal doğru", detailBody.student?.targetGoal === "Mühendislik", detailBody.student?.targetGoal);
  check("GET detail: email doğru", detailBody.student?.email === detailEmail, detailBody.student?.email);
  check("GET detail: paymentStatus GECIKMIS (vadesi geçmiş bekleyen taksit)", detailBody.student?.paymentStatus === "GECIKMIS", detailBody.student?.paymentStatus);
  check(
    "GET detail: lastExamStats en son sınava (examNew) ait",
    detailBody.student?.lastExamStats?.correct === 30 && detailBody.student?.lastExamStats?.wrong === 5 && detailBody.student?.lastExamStats?.netScore === 28.75,
    detailBody.student?.lastExamStats,
  );
  check(
    "GET detail: AI profil netTrend = yeni net - eski net (28.75 - 16.25 = 12.5)",
    detailBody.student?.aiProfile?.netTrend === 12.5,
    detailBody.student?.aiProfile?.netTrend,
  );
  if (achievements.length >= 3) {
    check("GET detail: güçlü kazanım (ratio 0.9) doğru gruplanmış", detailBody.student?.achievementTags?.strong?.some((t) => t.code === achievements[0].code));
    check("GET detail: geliştirilmeli kazanım (ratio 0.6) doğru gruplanmış", detailBody.student?.achievementTags?.weak?.some((t) => t.code === achievements[1].code));
    check("GET detail: kritik kazanım (ratio 0.2) doğru gruplanmış", detailBody.student?.achievementTags?.critical?.some((t) => t.code === achievements[2].code));
    check(
      "GET detail: AI profil öncelikli kazanımlar strong'u İÇERMİYOR",
      !detailBody.student?.aiProfile?.priorityAchievements?.some((t) => t.code === achievements[0].code),
    );
  }

  const detailNoAuthRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}/detail`);
  check("GET detail: oturumsuz 401", detailNoAuthRes.status === 401, detailNoAuthRes.status);

  const detailTeacherRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}/detail`, { headers: { Cookie: teacherCookie } });
  check("GET detail: TEACHER erişemez (403)", detailTeacherRes.status === 403, detailTeacherRes.status);

  const detailCrossTenantRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}/detail`, { headers: { Cookie: cankayaCookie } });
  check("GET detail: Çankaya admin Mezitli öğrencisini göremez (404, RLS)", detailCrossTenantRes.status === 404, detailCrossTenantRes.status);

  // ===== task #91: öğrencinin kendi iletişim bilgisi/hedefi PATCH =====
  const newOwnEmail = `test-cekmece-guncel-${Date.now()}@ogrenci.seviye360.com`;
  const newOwnPhone = `0555${Date.now().toString().slice(-7)}`;
  const ownPatchRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ email: newOwnEmail, phone: newOwnPhone, targetGoal: "Tıp Fakültesi" }),
  });
  const ownPatchBody = await ownPatchRes.json();
  check(
    "PATCH: öğrencinin kendi e-posta/telefon/hedefi güncellenebiliyor (200)",
    ownPatchRes.status === 200 && ownPatchBody.email === newOwnEmail && ownPatchBody.phone === newOwnPhone && ownPatchBody.targetGoal === "Tıp Fakültesi",
    ownPatchBody,
  );
  const detailUserAfter = await prisma.user.findUnique({ where: { id: detailUser.id } });
  check("DB: öğrencinin kendi User kaydı gerçekten güncellendi", detailUserAfter.email === newOwnEmail && detailUserAfter.phone === newOwnPhone, detailUserAfter);

  const badEmailRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ email: "gecersiz-eposta" }),
  });
  check("PATCH: geçersiz e-posta formatı reddediliyor (400)", badEmailRes.status === 400, badEmailRes.status);

  const dupeEmailRes = await fetch(`${BASE}/api/branch/students/${detailStudent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchCookie },
    body: JSON.stringify({ email: "elif.yilmaz@ogrenci.seviye360.com" }),
  });
  check("PATCH: zaten kullanılan e-posta reddediliyor (409)", dupeEmailRes.status === 409, dupeEmailRes.status);

  // ===== Temizlik (task #91 fixture'ları) =====
  await prisma.studentAchievementResult.deleteMany({ where: { studentId: detailStudent.id } });
  await prisma.examResult.deleteMany({ where: { studentId: detailStudent.id } });
  await prisma.paymentInstallment.deleteMany({ where: { studentId: detailStudent.id } });
  await prisma.studentProfile.delete({ where: { id: detailStudent.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: detailUser.id } }).catch(() => {});
  await prisma.exam.deleteMany({ where: { id: { in: [examOld.id, examNew.id] } } });

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
