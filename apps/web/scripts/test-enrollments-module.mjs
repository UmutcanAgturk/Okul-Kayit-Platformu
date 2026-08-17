// "Öğrenci Ön Kayıt" (Enrollment) modülünün ilk gerçek frontend'i + eksik
// PATCH/DELETE route'ları + complete route'undaki ON_KAYIT kısıtlamasının
// kaldırılması GERÇEK bir Postgres veritabanına karşı uçtan uca doğrulanır.
// Önkoşullar: kökte `npm run seed` çalıştırılmış, `npm run dev` sunucusu
// (localhost:3000) çalışıyor olmalı. Backend (GET/POST /api/branch/enrollments,
// POST .../complete) daha önceki bir oturumda eklenmişti ama hiç frontend'i
// yoktu ve complete route'u yalnızca NORMAL_KAYIT tipini kabul ediyordu — bu
// da demo'daki asıl akışı (Ön Kayıt → Normal Kayıt dönüştürme) engelliyordu.
//
// Kontrol ettikleri:
//   1. Yetki: yalnızca BRANCH_ADMIN/GUIDANCE_COORDINATOR listeleyebilir/
//      oluşturabilir/düzenleyebilir/iptal edebilir (TEACHER 403); başka bir
//      şubenin adayına erişim 404 (tenant izolasyonu).
//   2. Oluşturma + listeleme + stage filtresi.
//   3. PATCH ile düzenleme.
//   4. DELETE = soft-cancel (stage IPTAL_EDILDI, satır silinmiyor).
//   5. Bir ON_KAYIT adayının artık `complete` ile tamamlanabildiği (önceki
//      "yalnızca NORMAL_KAYIT" kısıtlaması kaldırıldı) — gerçek
//      User+StudentProfile+PaymentInstallment[] oluşuyor, dönen kimlik
//      bilgileriyle GERÇEK bir login yapılabiliyor.
//   6. Tamamlanmış/iptal edilmiş adaylar kilitli: PATCH/DELETE/complete 409.
//   7. Aktivite Akışı'na yansıma.
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
  const branchAdminCookie = await loginAs("merve.aslan@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Mezitli) login başarılı", !!branchAdminCookie);
  const teacherCookie = await loginAs("ayse.demir@seviye360.com", SEED_DEV_PASSWORD);
  check("TEACHER login başarılı", !!teacherCookie);
  const otherBranchAdminCookie = await loginAs("onur.kaya@seviye360.com", SEED_DEV_PASSWORD);
  check("BRANCH_ADMIN (Çankaya) login başarılı", !!otherBranchAdminCookie);

  // ===== Yetki: oturumsuz / yanlış rol =====
  const noAuthRes = await fetch(`${BASE}/api/branch/enrollments`);
  check("GET enrollments: oturumsuz 401", noAuthRes.status === 401, noAuthRes.status);

  const teacherListRes = await fetch(`${BASE}/api/branch/enrollments`, { headers: { Cookie: teacherCookie } });
  check("TEACHER listeleyemez: 403", teacherListRes.status === 403, teacherListRes.status);

  const teacherCreateRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: "X Y", candidateGradeLevel: "SINIF_9", guardianFullName: "V V", guardianPhone: "0500" }),
  });
  check("TEACHER oluşturamaz: 403", teacherCreateRes.status === 403, teacherCreateRes.status);

  // ===== Listeleme: seed'deki Kerem Şahin görünüyor =====
  const listRes = await fetch(`${BASE}/api/branch/enrollments`, { headers: { Cookie: branchAdminCookie } });
  const listBody = await listRes.json();
  check("BRANCH_ADMIN listeler: 200", listRes.status === 200, listRes.status);
  check("Liste: seed'deki Kerem Şahin görünüyor", listBody.enrollments?.some((e) => e.candidateFullName === "Kerem Şahin"));

  // ===== Oluşturma =====
  const uniqueName = `Test Aday ${Date.now()}`;
  const createRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      type: "ON_KAYIT",
      candidateFullName: uniqueName,
      candidateGradeLevel: "SINIF_9",
      guardianFullName: "Test Veli",
      guardianPhone: "05551112233",
      depositAmount: 1000,
    }),
  });
  const createBody = await createRes.json();
  check("POST enrollments: 201", createRes.status === 201, createRes.status);
  const enrollmentId = createBody.enrollment?.id;
  check("Oluşturulan stage=ON_KAYIT_ALINDI", createBody.enrollment?.stage === "ON_KAYIT_ALINDI", createBody.enrollment?.stage);
  check("programType belirtilmezse varsayılan 'Normal Kayıt'", createBody.enrollment?.programType === "Normal Kayıt", createBody.enrollment?.programType);

  // ===== programType: oluşturma sırasında açıkça belirtme =====
  const programTypeName = `Test Yaz Kursu ${Date.now()}`;
  const createProgramTypeRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      type: "ON_KAYIT",
      programType: "Yaz Kursu",
      candidateFullName: programTypeName,
      candidateGradeLevel: "SINIF_9",
      guardianFullName: "Test Veli Yaz",
      guardianPhone: "05551119900",
    }),
  });
  const createProgramTypeBody = await createProgramTypeRes.json();
  const programTypeEnrollmentId = createProgramTypeBody.enrollment?.id;
  check("POST enrollments: açık programType='Yaz Kursu' kaydedildi", createProgramTypeBody.enrollment?.programType === "Yaz Kursu", createProgramTypeBody.enrollment?.programType);

  const getProgramTypeRes = await fetch(`${BASE}/api/branch/enrollments`, { headers: { Cookie: branchAdminCookie } });
  const getProgramTypeBody = await getProgramTypeRes.json();
  check(
    "GET listesinde programType='Yaz Kursu' doğru dönüyor",
    getProgramTypeBody.enrollments?.find((e) => e.id === programTypeEnrollmentId)?.programType === "Yaz Kursu",
  );

  // ===== stage filtresi =====
  const filteredRes = await fetch(`${BASE}/api/branch/enrollments?stage=ON_KAYIT_ALINDI`, { headers: { Cookie: branchAdminCookie } });
  const filteredBody = await filteredRes.json();
  check("stage filtresi: yeni aday listede", filteredBody.enrollments?.some((e) => e.id === enrollmentId));

  // ===== Çapraz-tenant izolasyonu =====
  const crossPatchRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: otherBranchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05559998877" }),
  });
  check("Çankaya admin Mezitli adayını düzenleyemez: 404", crossPatchRes.status === 404, crossPatchRes.status);

  const crossDeleteRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, { method: "DELETE", headers: { Cookie: otherBranchAdminCookie } });
  check("Çankaya admin Mezitli adayını iptal edemez: 404", crossDeleteRes.status === 404, crossDeleteRes.status);

  // ===== Düzenleme (PATCH) =====
  const patchRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05559998877" }),
  });
  const patchBody = await patchRes.json();
  check("PATCH: 200 + telefon güncellendi", patchRes.status === 200 && patchBody.enrollment?.guardianPhone === "05559998877", patchBody.enrollment?.guardianPhone);

  // ===== programType: PATCH ile güncelleme =====
  const patchProgramTypeRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ programType: "Deneme Kulübü" }),
  });
  const patchProgramTypeBody = await patchProgramTypeRes.json();
  check(
    "PATCH: programType='Deneme Kulübü' olarak güncellendi",
    patchProgramTypeRes.status === 200 && patchProgramTypeBody.enrollment?.programType === "Deneme Kulübü",
    patchProgramTypeBody.enrollment?.programType,
  );
  const dbProgramType = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  check("DB: programType kalıcı olarak güncellendi", dbProgramType?.programType === "Deneme Kulübü", dbProgramType?.programType);

  // ===== Kayıt Tamamlama (ON_KAYIT tipi — önceki kısıtlama kaldırıldı) =====
  // Genişletilmiş form alanları: T.C. Kimlik No, doğum tarihi, cinsiyet,
  // sözleşme onayı, ödeme yöntemi (SENET → otomatik senet üretimi).
  const firstDueDate = new Date().toISOString().slice(0, 10);
  const testNationalId = "12345678901";
  const completeRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({
      installmentCount: 3,
      installmentAmount: 2000,
      firstDueDate,
      nationalId: testNationalId,
      birthDate: "2011-05-15",
      gender: "Kadın",
      contractAccepted: true,
      paymentMethodType: "SENET",
    }),
  });
  const completeBody = await completeRes.json();
  check("POST complete (ON_KAYIT tipi): 201", completeRes.status === 201, completeRes.status);
  check("complete: 3 taksit oluştu", completeBody.installments?.length === 3, completeBody.installments?.length);
  check("complete: enrollment KAYIT_TAMAMLANDI", completeBody.enrollment?.stage === "KAYIT_TAMAMLANDI", completeBody.enrollment?.stage);
  check("complete: credentials döndü", !!completeBody.credentials?.username && !!completeBody.credentials?.password);
  check(
    "complete (task #90): veli için de credentials döndü",
    !!completeBody.parentCredentials?.username && !!completeBody.parentCredentials?.password,
    completeBody.parentCredentials,
  );
  check("complete: parentLinkedExisting false (yeni veli hesabı)", completeBody.parentLinkedExisting === false, completeBody.parentLinkedExisting);
  check("complete: enrollment.contractSignedAt set edildi", !!completeBody.enrollment?.contractSignedAt, completeBody.enrollment?.contractSignedAt);
  check("complete: student.nationalId/gender kaydedildi", completeBody.student?.nationalId === testNationalId && completeBody.student?.gender === "Kadın", completeBody.student);
  check(
    "complete: SENET seçilince taksit sayısı kadar promissoryNotes üretildi",
    completeBody.promissoryNotes?.length === 3 && completeBody.promissoryNotes.every((n) => n.no?.startsWith("SNT-")),
    completeBody.promissoryNotes,
  );
  check("complete: SENET seçilince paymentMethod OLUŞMADI (yalnızca senet)", completeBody.paymentMethod === null, completeBody.paymentMethod);

  const studentId = completeBody.student?.id;

  // ===== Üretilen hesapla GERÇEK login =====
  const studentLoginCookie = completeBody.credentials ? await loginAs(completeBody.credentials.username, completeBody.credentials.password) : null;
  check("Üretilen öğrenci hesabıyla giriş başarılı", !!studentLoginCookie);
  if (studentLoginCookie) {
    const meRes = await fetch(`${BASE}/api/me`, { headers: { Cookie: studentLoginCookie } });
    const meBody = await meRes.json();
    check("Giriş yapan hesap STUDENT rolünde", meBody.role === "STUDENT", meBody.role);
  }
  if (studentId) {
    const dbStudent = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    check("Oluşturulan StudentProfile doğru sınıf düzeyinde", dbStudent?.gradeLevel === "SINIF_9", dbStudent?.gradeLevel);
    const dbNotes = await prisma.promissoryNote.findMany({ where: { studentId } });
    check("DB: 3 PromissoryNote gerçekten oluşmuş", dbNotes.length === 3, dbNotes.length);

    // ===== task #90: veli hesabı DB'de gerçekten oluşmuş mu =====
    const dbGuardianLink = await prisma.studentGuardian.findFirst({
      where: { studentId },
      include: { parent: { include: { user: true } } },
    });
    check("DB: StudentGuardian bağlantısı oluştu", !!dbGuardianLink, dbGuardianLink);
    check("DB: veli User'ı PARENT rolünde", dbGuardianLink?.parent?.user?.role === "PARENT", dbGuardianLink?.parent?.user?.role);
    check(
      "DB: veli User email'i credentials.username ile eşleşiyor",
      dbGuardianLink?.parent?.user?.email === completeBody.parentCredentials?.username,
      dbGuardianLink?.parent?.user?.email,
    );
    check("DB: StudentGuardian.isBillingResponsible true", dbGuardianLink?.isBillingResponsible === true, dbGuardianLink?.isBillingResponsible);

    const parentLoginCookie = completeBody.parentCredentials
      ? await loginAs(completeBody.parentCredentials.username, completeBody.parentCredentials.password)
      : null;
    check("Üretilen veli hesabıyla giriş başarılı", !!parentLoginCookie);
    if (parentLoginCookie) {
      const parentMeRes = await fetch(`${BASE}/api/me`, { headers: { Cookie: parentLoginCookie } });
      const parentMeBody = await parentMeRes.json();
      check("Giriş yapan veli hesabı PARENT rolünde", parentMeBody.role === "PARENT", parentMeBody.role);
    }
  }

  // ===== task #90: kardeş kaydı — aynı guardianPhone ile TEKRAR veli hesabı AÇILMAMALI =====
  const siblingName = `Test Kardeş ${Date.now()}`;
  const createSiblingRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    // NOT: enrollmentId'nin guardianPhone'u yukarıdaki PATCH testinde
    // "05559998877" olarak güncellendi — kardeş eşleşmesi bu GÜNCEL numarayı
    // kullanmalı, oluşturma anındaki orijinal "05551112233"'ü değil.
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: siblingName, candidateGradeLevel: "SINIF_9", guardianFullName: "Test Veli", guardianPhone: "05559998877" }),
  });
  const createSiblingBody = await createSiblingRes.json();
  const siblingEnrollmentId = createSiblingBody.enrollment?.id;
  const siblingCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${siblingEnrollmentId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1500, firstDueDate }),
  });
  const siblingCompleteBody = await siblingCompleteRes.json();
  check("complete (kardeş): 201", siblingCompleteRes.status === 201, siblingCompleteRes.status);
  check("complete (kardeş): parentLinkedExisting true", siblingCompleteBody.parentLinkedExisting === true, siblingCompleteBody.parentLinkedExisting);
  check("complete (kardeş): parentCredentials null (yeni hesap YOK)", siblingCompleteBody.parentCredentials === null, siblingCompleteBody.parentCredentials);

  const siblingStudentId = siblingCompleteBody.student?.id;
  if (siblingStudentId && studentId) {
    const [firstGuardian, siblingGuardian] = await Promise.all([
      prisma.studentGuardian.findFirst({ where: { studentId } }),
      prisma.studentGuardian.findFirst({ where: { studentId: siblingStudentId } }),
    ]);
    check(
      "DB: kardeşler AYNI ParentProfile'a bağlı",
      !!firstGuardian?.parentId && firstGuardian.parentId === siblingGuardian?.parentId,
      { first: firstGuardian?.parentId, sibling: siblingGuardian?.parentId },
    );
    const parentUserCount = await prisma.user.count({ where: { email: completeBody.parentCredentials?.username } });
    check("DB: veli için hâlâ TEK bir User var (ikinci hesap açılmadı)", parentUserCount === 1, parentUserCount);
  }

  // ===== Kilitli durum: tekrar tamamlama / düzenleme / iptal =====
  const reCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 3, installmentAmount: 2000, firstDueDate }),
  });
  check("Tekrar complete: 409", reCompleteRes.status === 409, reCompleteRes.status);

  const patchAfterCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05550000000" }),
  });
  check("Tamamlanmış adayı düzenleme: 409", patchAfterCompleteRes.status === 409, patchAfterCompleteRes.status);

  const deleteAfterCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${enrollmentId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Tamamlanmış adayı iptal etme: 409", deleteAfterCompleteRes.status === 409, deleteAfterCompleteRes.status);

  // ===== İkinci aday: iptal (soft-cancel) akışı =====
  const secondName = `Test İptal ${Date.now()}`;
  const createSecondRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: secondName, candidateGradeLevel: "SINIF_10", guardianFullName: "Veli İki", guardianPhone: "05552223344" }),
  });
  const createSecondBody = await createSecondRes.json();
  const secondId = createSecondBody.enrollment?.id;

  const cancelRes = await fetch(`${BASE}/api/branch/enrollments/${secondId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  const cancelBody = await cancelRes.json();
  check("DELETE (iptal): 200 + stage IPTAL_EDILDI", cancelRes.status === 200 && cancelBody.enrollment?.stage === "IPTAL_EDILDI", cancelBody.enrollment?.stage);

  const dbCancelled = await prisma.enrollment.findUnique({ where: { id: secondId } });
  check("İptal: satır silinmedi, sadece stage değişti (soft-cancel)", !!dbCancelled && dbCancelled.stage === "IPTAL_EDILDI");

  const reCancelRes = await fetch(`${BASE}/api/branch/enrollments/${secondId}`, { method: "DELETE", headers: { Cookie: branchAdminCookie } });
  check("Tekrar iptal: 409", reCancelRes.status === 409, reCancelRes.status);

  const patchCancelledRes = await fetch(`${BASE}/api/branch/enrollments/${secondId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ guardianPhone: "05550000001" }),
  });
  check("İptal edilmiş adayı düzenleme: 409", patchCancelledRes.status === 409, patchCancelledRes.status);

  // ===== Üçüncü aday: busRouteId + duplicate nationalId + non-SENET paymentMethod =====
  const mezitliTenant = await prisma.tenant.findFirst({ where: { name: { contains: "Mezitli" } } });
  const busRoute = await prisma.busRoute.create({
    data: { tenantId: mezitliTenant.id, name: `Test Güzergahı ${Date.now()}`, capacity: 20 },
  });

  const thirdName = `Test Servis ${Date.now()}`;
  const createThirdRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: thirdName, candidateGradeLevel: "SINIF_9", guardianFullName: "Veli Üç", guardianPhone: "05553334455" }),
  });
  const createThirdBody = await createThirdRes.json();
  const thirdId = createThirdBody.enrollment?.id;

  const badNationalIdRes = await fetch(`${BASE}/api/branch/enrollments/${thirdId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, nationalId: "123" }),
  });
  check("complete: 11 haneli olmayan nationalId 400 ile reddediliyor", badNationalIdRes.status === 400, badNationalIdRes.status);

  const dupeNationalIdRes = await fetch(`${BASE}/api/branch/enrollments/${thirdId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, nationalId: testNationalId }),
  });
  check("complete: zaten kullanılan nationalId 409 ile reddediliyor", dupeNationalIdRes.status === 409, dupeNationalIdRes.status);

  const badBusRouteRes = await fetch(`${BASE}/api/branch/enrollments/${thirdId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, busRouteId: "olmayan-id" }),
  });
  check("complete: geçersiz busRouteId 400 ile reddediliyor", badBusRouteRes.status === 400, badBusRouteRes.status);

  const thirdCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${thirdId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, busRouteId: busRoute.id, paymentMethodType: "NAKIT" }),
  });
  const thirdCompleteBody = await thirdCompleteRes.json();
  check("complete: servis güzergahıyla 201", thirdCompleteRes.status === 201, thirdCompleteRes.status);
  check("complete: student.busRouteId kaydedildi", thirdCompleteBody.student?.busRouteId === busRoute.id, thirdCompleteBody.student?.busRouteId);
  check(
    "complete: NAKIT seçilince tek bir PaymentMethod oluştu (senet değil)",
    thirdCompleteBody.paymentMethod?.type === "NAKIT" && (thirdCompleteBody.promissoryNotes?.length ?? 0) === 0,
    thirdCompleteBody.paymentMethod,
  );

  const thirdStudentId = thirdCompleteBody.student?.id;

  // ===== complete: targetClassroomId + phone (task #86) =====
  const mezitliClassroom = await prisma.classroom.findFirst({ where: { tenantId: mezitliTenant.id, gradeLevel: "SINIF_9" } });
  const mismatchClassroom = await prisma.classroom.create({
    data: { tenantId: mezitliTenant.id, name: `Test-Yanlis-Seviye-${Date.now()}`, gradeLevel: "SINIF_10", capacity: 30 },
  });

  const fourthName = `Test HedefSinif ${Date.now()}`;
  const createFourthRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: fourthName, candidateGradeLevel: "SINIF_9", guardianFullName: "Veli Dört", guardianPhone: "05554445566" }),
  });
  const createFourthBody = await createFourthRes.json();
  const fourthId = createFourthBody.enrollment?.id;

  const badClassroomRes = await fetch(`${BASE}/api/branch/enrollments/${fourthId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, targetClassroomId: "olmayan-id" }),
  });
  check("complete: geçersiz targetClassroomId 400 ile reddediliyor", badClassroomRes.status === 400, badClassroomRes.status);

  const gradeMismatchRes = await fetch(`${BASE}/api/branch/enrollments/${fourthId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, targetClassroomId: mismatchClassroom.id }),
  });
  check("complete: seviyesi uyuşmayan sınıf 400 ile reddediliyor", gradeMismatchRes.status === 400, gradeMismatchRes.status);

  const badPhoneRes = await fetch(`${BASE}/api/branch/enrollments/${fourthId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, phone: "123" }),
  });
  check("complete: geçersiz phone 400 ile reddediliyor", badPhoneRes.status === 400, badPhoneRes.status);

  const fourthPhone = `0555${Date.now().toString().slice(-7)}`;
  const fourthCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${fourthId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, targetClassroomId: mezitliClassroom.id, phone: fourthPhone }),
  });
  const fourthCompleteBody = await fourthCompleteRes.json();
  check("complete: geçerli hedef sınıf + telefonla 201", fourthCompleteRes.status === 201, fourthCompleteRes.status);

  const fourthStudentId = fourthCompleteBody.student?.id;
  const dbFourthStudent = await prisma.studentProfile.findUnique({ where: { id: fourthStudentId }, include: { user: true } });
  check("DB: student.classroomId hedef sınıfa eşit", dbFourthStudent?.classroomId === mezitliClassroom.id, dbFourthStudent?.classroomId);
  check("DB: student user.phone kaydedildi", dbFourthStudent?.user?.phone === fourthPhone, dbFourthStudent?.user?.phone);
  const dbFourthEnrollment = await prisma.enrollment.findUnique({ where: { id: fourthId } });
  check("DB: enrollment.targetClassroomId senkron güncellendi", dbFourthEnrollment?.targetClassroomId === mezitliClassroom.id, dbFourthEnrollment?.targetClassroomId);

  // Aynı telefonla ikinci bir tamamlama denemesi (aynı tenant) 409 vermeli.
  const fifthName = `Test Telefon Cakisma ${Date.now()}`;
  const createFifthRes = await fetch(`${BASE}/api/branch/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ type: "ON_KAYIT", candidateFullName: fifthName, candidateGradeLevel: "SINIF_9", guardianFullName: "Veli Beş", guardianPhone: "05556667788" }),
  });
  const createFifthBody = await createFifthRes.json();
  const fifthId = createFifthBody.enrollment?.id;
  const dupePhoneCompleteRes = await fetch(`${BASE}/api/branch/enrollments/${fifthId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: branchAdminCookie },
    body: JSON.stringify({ installmentCount: 1, installmentAmount: 1000, firstDueDate, phone: fourthPhone }),
  });
  check("complete: aynı tenant içinde tekrar kullanılan phone 409 ile reddediliyor", dupePhoneCompleteRes.status === 409, dupePhoneCompleteRes.status);

  // ===== Aktivite Akışı =====
  const activityRes = await fetch(`${BASE}/api/branch/activity-log`, { headers: { Cookie: branchAdminCookie } });
  const activityBody = await activityRes.json();
  const actions = (activityBody.entries || []).map((e) => e.action);
  check("Aktivite Akışı: kayıt adayı eklendi", actions.includes("Kayıt adayı eklendi"));
  check("Aktivite Akışı: kayıt adayı düzenlendi", actions.includes("Kayıt adayı düzenlendi"));
  check("Aktivite Akışı: kayıt tamamlandı", actions.includes("Kayıt tamamlandı"));
  check("Aktivite Akışı: kayıt adayı iptal edildi", actions.includes("Kayıt adayı iptal edildi"));

  // ===== Temizlik (yalnızca bu testin oluşturduğu veriler; seed'deki Kerem Şahin dokunulmadı) =====
  if (siblingStudentId) {
    await prisma.paymentInstallment.deleteMany({ where: { studentId: siblingStudentId } });
    await prisma.studentProfile.delete({ where: { id: siblingStudentId } }).catch(() => {});
    if (siblingCompleteBody.credentials?.username) {
      await prisma.user.deleteMany({ where: { email: siblingCompleteBody.credentials.username } });
    }
    // Beklenen durumda kardeş için YENİ bir veli hesabı açılmaz (mevcut hesaba
    // bağlanır); ama beklenmedik bir eşleşmeme durumunda leftover kalmaması
    // için savunmacı temizlik.
    if (siblingCompleteBody.parentCredentials?.username) {
      await prisma.user.deleteMany({ where: { email: siblingCompleteBody.parentCredentials.username } });
    }
  }
  if (studentId) {
    await prisma.promissoryNote.deleteMany({ where: { studentId } });
    await prisma.paymentInstallment.deleteMany({ where: { studentId } });
    await prisma.studentProfile.delete({ where: { id: studentId } }).catch(() => {});
    if (completeBody.credentials?.username) {
      await prisma.user.deleteMany({ where: { email: completeBody.credentials.username } });
    }
    // task #90: veli hesabı (StudentGuardian cascade ile zaten silindi, User'ı ayrıca sil)
    if (completeBody.parentCredentials?.username) {
      await prisma.user.deleteMany({ where: { email: completeBody.parentCredentials.username } });
    }
  }
  if (thirdStudentId) {
    await prisma.paymentMethod.deleteMany({ where: { studentId: thirdStudentId } });
    await prisma.paymentInstallment.deleteMany({ where: { studentId: thirdStudentId } });
    await prisma.studentProfile.delete({ where: { id: thirdStudentId } }).catch(() => {});
    if (thirdCompleteBody.credentials?.username) {
      await prisma.user.deleteMany({ where: { email: thirdCompleteBody.credentials.username } });
    }
    if (thirdCompleteBody.parentCredentials?.username) {
      await prisma.user.deleteMany({ where: { email: thirdCompleteBody.parentCredentials.username } });
    }
  }
  if (fourthStudentId) {
    await prisma.paymentInstallment.deleteMany({ where: { studentId: fourthStudentId } });
    await prisma.studentProfile.delete({ where: { id: fourthStudentId } }).catch(() => {});
    if (fourthCompleteBody.credentials?.username) {
      await prisma.user.deleteMany({ where: { email: fourthCompleteBody.credentials.username } });
    }
    if (fourthCompleteBody.parentCredentials?.username) {
      await prisma.user.deleteMany({ where: { email: fourthCompleteBody.parentCredentials.username } });
    }
  }
  await prisma.busRoute.delete({ where: { id: busRoute.id } }).catch(() => {});
  await prisma.classroom.delete({ where: { id: mismatchClassroom.id } }).catch(() => {});
  await prisma.enrollment.deleteMany({
    where: { id: { in: [enrollmentId, secondId, thirdId, fourthId, fifthId, siblingEnrollmentId, programTypeEnrollmentId].filter(Boolean) } },
  });
  await prisma.auditLogEntry.deleteMany({
    where: { action: { in: ["Kayıt adayı eklendi", "Kayıt adayı düzenlendi", "Kayıt tamamlandı", "Kayıt adayı iptal edildi"] } },
  });

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
