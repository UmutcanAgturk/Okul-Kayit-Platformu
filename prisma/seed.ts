// Taksit/tahsilat API'sini gerçek bir veritabanına karşı test edebilmek için
// minimal ama gerçekçi bir kurum -> şube -> sınıf -> öğrenci -> taksit zinciri
// oluşturur. Rakamlar demo artifact'ındaki (seviye360-app.html) varsayılan
// seed ile aynı (9 taksit, taksit başına ₺10.000, ilk 2'si ödenmiş) — böylece
// iki modelin aynı senaryoyu temsil ettiği doğrulanabilir.
import { PrismaClient, TenantType, UserRole, GradeLevel, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Tüm seed kullanıcıları için ortak, gerçek bir bcrypt hash'i — /api/auth/login
// akışını uçtan uca test edebilmek için (bkz. apps/web/scripts/test-auth.mjs).
// Yalnızca yerel geliştirme amaçlıdır.
export const SEED_DEV_PASSWORD = "seviye360dev-pw";

async function main() {
  const passwordHash = await bcrypt.hash(SEED_DEV_PASSWORD, 10);
  const genelMerkez = await prisma.tenant.upsert({
    where: { code: "GENEL-MERKEZ" },
    update: {},
    create: { name: "Seviye 360 Genel Merkez", code: "GENEL-MERKEZ", type: TenantType.GENEL_MERKEZ },
  });

  const mezitli = await prisma.tenant.upsert({
    where: { code: "MEZITLI-01" },
    update: {},
    create: {
      name: "Özel Mezitli Seviye Anadolu Lisesi",
      code: "MEZITLI-01",
      type: TenantType.SUBE,
      city: "Mersin",
      district: "Mezitli",
      parentId: genelMerkez.id,
    },
  });

  const classroom = await prisma.classroom.upsert({
    where: { tenantId_name: { tenantId: mezitli.id, name: "9-A" } },
    update: {},
    create: { tenantId: mezitli.id, name: "9-A", gradeLevel: GradeLevel.SINIF_9 },
  });

  const branchAdminUser = await prisma.user.upsert({
    where: { email: "merve.aslan@seviye360.com" },
    update: {},
    create: {
      tenantId: mezitli.id,
      email: "merve.aslan@seviye360.com",
      passwordHash,
      role: UserRole.BRANCH_ADMIN,
      firstName: "Merve",
      lastName: "Aslan",
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "elif.yilmaz@ogrenci.seviye360.com" },
    update: {},
    create: {
      tenantId: mezitli.id,
      email: "elif.yilmaz@ogrenci.seviye360.com",
      passwordHash,
      role: UserRole.STUDENT,
      firstName: "Elif",
      lastName: "Yılmaz",
    },
  });

  const student = await prisma.studentProfile.upsert({
    where: { studentNo: "201001" },
    update: {},
    create: {
      tenantId: mezitli.id,
      userId: studentUser.id,
      gradeLevel: GradeLevel.SINIF_9,
      classroomId: classroom.id,
      studentNo: "201001",
    },
  });

  const guardianUser = await prisma.user.upsert({
    where: { email: "hakan.yilmaz@veli.seviye360.com" },
    update: {},
    create: {
      tenantId: mezitli.id,
      email: "hakan.yilmaz@veli.seviye360.com",
      passwordHash,
      role: UserRole.PARENT,
      firstName: "Hakan",
      lastName: "Yılmaz",
    },
  });

  const guardianProfile = await prisma.parentProfile.upsert({
    where: { userId: guardianUser.id },
    update: {},
    create: { userId: guardianUser.id },
  });

  await prisma.studentGuardian.upsert({
    where: { studentId_parentId: { studentId: student.id, parentId: guardianProfile.id } },
    update: {},
    create: { studentId: student.id, parentId: guardianProfile.id, relation: "Baba", isBillingResponsible: true },
  });

  // 9 taksit, taksit başına ₺10.000 — ilk 2'si ödenmiş, geri kalanı bekliyor
  // (demo'daki `installmentCount: 9, installmentAmount: 10000, paidInstallments: 2` ile birebir).
  const existingInstallments = await prisma.paymentInstallment.count({ where: { studentId: student.id } });
  if (existingInstallments === 0) {
    for (let no = 1; no <= 9; no++) {
      const dueDate = new Date(Date.UTC(2026, 8, 1));
      dueDate.setUTCMonth(dueDate.getUTCMonth() + (no - 1));
      const isPaid = no <= 2;
      await prisma.paymentInstallment.create({
        data: {
          tenantId: mezitli.id,
          studentId: student.id,
          installmentNo: no,
          amount: 10000,
          dueDate,
          paidAt: isPaid ? dueDate : null,
          status: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        },
      });
    }
  }

  // İkinci bir şube (farklı şehir/tenant) — tek başına taksit testi için
  // gerekli değildi, ama Row-Level Security'nin gerçekten tenant'lar arası
  // izolasyon sağladığını kanıtlamak için ikinci bir tenant'a ait veri şart
  // (bkz. prisma/rls, scripts/test-rls-isolation.mjs).
  const cankaya = await prisma.tenant.upsert({
    where: { code: "CANKAYA-01" },
    update: {},
    create: {
      name: "Özel Çankaya Seviye Kurs Merkezi",
      code: "CANKAYA-01",
      type: TenantType.SUBE,
      city: "Ankara",
      district: "Çankaya",
      parentId: genelMerkez.id,
    },
  });

  const cankayaAdminUser = await prisma.user.upsert({
    where: { email: "onur.kaya@seviye360.com" },
    update: {},
    create: {
      tenantId: cankaya.id,
      email: "onur.kaya@seviye360.com",
      passwordHash,
      role: UserRole.BRANCH_ADMIN,
      firstName: "Onur",
      lastName: "Kaya",
    },
  });

  const cankayaStudentUser = await prisma.user.upsert({
    where: { email: "mehmet.kaya@ogrenci.seviye360.com" },
    update: {},
    create: {
      tenantId: cankaya.id,
      email: "mehmet.kaya@ogrenci.seviye360.com",
      passwordHash,
      role: UserRole.STUDENT,
      firstName: "Mehmet",
      lastName: "Kaya",
    },
  });

  const cankayaClassroom = await prisma.classroom.upsert({
    where: { tenantId_name: { tenantId: cankaya.id, name: "10-A" } },
    update: {},
    create: { tenantId: cankaya.id, name: "10-A", gradeLevel: GradeLevel.SINIF_10 },
  });

  const cankayaStudent = await prisma.studentProfile.upsert({
    where: { studentNo: "201002" },
    update: {},
    create: {
      tenantId: cankaya.id,
      userId: cankayaStudentUser.id,
      gradeLevel: GradeLevel.SINIF_10,
      classroomId: cankayaClassroom.id,
      studentNo: "201002",
    },
  });

  const cankayaLedgerCount = await prisma.accountingLedgerEntry.count({ where: { tenantId: cankaya.id } });
  if (cankayaLedgerCount === 0) {
    await prisma.accountingLedgerEntry.create({
      data: {
        tenantId: cankaya.id,
        type: "GELIR",
        category: "Taksit Tahsilatı",
        amount: 15000,
        entryDate: new Date(),
        createdByUserId: cankayaAdminUser.id,
      },
    });
  }

  // Öğretmen kullanıcısı + AI_SUGGESTED bir etüt seansı — Etüt onay/red API'sini
  // (bkz. apps/web/app/api/teacher/study-sessions) test edebilmek için.
  const teacherUser = await prisma.user.upsert({
    where: { email: "ayse.demir@seviye360.com" },
    update: {},
    create: {
      tenantId: mezitli.id,
      email: "ayse.demir@seviye360.com",
      passwordHash,
      role: UserRole.TEACHER,
      firstName: "Ayşe",
      lastName: "Demir",
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: { userId: teacherUser.id, branch: "Matematik" },
  });

  const achievement = await prisma.curriculumNode.upsert({
    where: { code: "MAT.9.1.2.3" },
    update: {},
    create: { type: "ACHIEVEMENT", code: "MAT.9.1.2.3", label: "Rasyonel Sayılar", gradeLevel: 9 },
  });

  const existingSession = await prisma.studySession.findFirst({
    where: { studentId: student.id, teacherId: teacherProfile.id, achievementId: achievement.id },
  });
  const studySession = existingSession ?? await prisma.studySession.create({
    data: {
      tenantId: mezitli.id,
      studentId: student.id,
      teacherId: teacherProfile.id,
      achievementId: achievement.id,
      status: "AI_SUGGESTED",
      source: "AI_AUTO_ASSIGNED",
      scheduledStart: new Date(Date.UTC(2026, 7, 25, 14, 0)),
      scheduledEnd: new Date(Date.UTC(2026, 7, 25, 14, 40)),
    },
  });

  console.log("Seed tamamlandı:");
  console.log("  Şube 1 (Tenant):", mezitli.id, mezitli.name);
  console.log("  Öğrenci 1 (StudentProfile):", student.id, "-", studentUser.firstName, studentUser.lastName);
  console.log("  Şube Yöneticisi 1 (User):", branchAdminUser.id, "-", branchAdminUser.email);
  console.log("  Şube 2 (Tenant):", cankaya.id, cankaya.name);
  console.log("  Öğrenci 2 (StudentProfile):", cankayaStudent.id, "-", cankayaStudentUser.firstName, cankayaStudentUser.lastName);
  console.log("  Şube Yöneticisi 2 (User):", cankayaAdminUser.id, "-", cankayaAdminUser.email);
  console.log("  Öğretmen (User):", teacherUser.id, "-", teacherUser.email);
  console.log("  Etüt Seansı (StudySession, AI_SUGGESTED):", studySession.id);
  console.log("  Tüm seed kullanıcıları için şifre:", SEED_DEV_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
