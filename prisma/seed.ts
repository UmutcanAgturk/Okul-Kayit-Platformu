// Taksit/tahsilat API'sini gerçek bir veritabanına karşı test edebilmek için
// minimal ama gerçekçi bir kurum -> şube -> sınıf -> öğrenci -> taksit zinciri
// oluşturur. Rakamlar demo artifact'ındaki (seviye360-app.html) varsayılan
// seed ile aynı (9 taksit, taksit başına ₺10.000, ilk 2'si ödenmiş) — böylece
// iki modelin aynı senaryoyu temsil ettiği doğrulanabilir.
import { PrismaClient, TenantType, UserRole, GradeLevel, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
      passwordHash: "dev-only-not-a-real-hash",
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
      passwordHash: "dev-only-not-a-real-hash",
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
      passwordHash: "dev-only-not-a-real-hash",
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
      passwordHash: "dev-only-not-a-real-hash",
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
      passwordHash: "dev-only-not-a-real-hash",
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

  console.log("Seed tamamlandı:");
  console.log("  Şube 1 (Tenant):", mezitli.id, mezitli.name);
  console.log("  Öğrenci 1 (StudentProfile):", student.id, "-", studentUser.firstName, studentUser.lastName);
  console.log("  Şube Yöneticisi 1 (User):", branchAdminUser.id, "-", branchAdminUser.email);
  console.log("  Şube 2 (Tenant):", cankaya.id, cankaya.name);
  console.log("  Öğrenci 2 (StudentProfile):", cankayaStudent.id, "-", cankayaStudentUser.firstName, cankayaStudentUser.lastName);
  console.log("  Şube Yöneticisi 2 (User):", cankayaAdminUser.id, "-", cankayaAdminUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
