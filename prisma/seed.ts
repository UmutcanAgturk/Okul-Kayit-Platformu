// Taksit/tahsilat API'sini gerçek bir veritabanına karşı test edebilmek için
// minimal ama gerçekçi bir kurum -> şube -> sınıf -> öğrenci -> taksit zinciri
// oluşturur. Rakamlar demo artifact'ındaki (seviye360-app.html) varsayılan
// seed ile aynı (9 taksit, taksit başına ₺10.000, ilk 2'si ödenmiş) — böylece
// iki modelin aynı senaryoyu temsil ettiği doğrulanabilir.
import { PrismaClient, TenantType, UserRole, GradeLevel, PaymentStatus, ExamType, ExamScope } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computePayroll } from "../apps/web/lib/payroll";

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

  // SUPERADMIN'in tenantId'si yoktur (Genel Merkez, tek bir şubeye bağlı
  // değildir) — bkz. schema.prisma User.tenantId yorumu ve db-context.ts'teki
  // withTenantContext (SUPERADMIN için superadmin_role/BYPASSRLS'e geçer).
  const superadminUser = await prisma.user.upsert({
    where: { email: "admin@seviye360.com" },
    update: {},
    create: {
      tenantId: null,
      email: "admin@seviye360.com",
      passwordHash,
      role: UserRole.SUPERADMIN,
      firstName: "Seviye 360",
      lastName: "Genel Merkez",
    },
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

  // Mezitli'nin Muhasebe defterinde (bkz. apps/web/app/api/branch/accounting-ledger)
  // baştan itibaren birkaç kayıt olsun diye — taksit tahsilatı API'sinin
  // kendi oluşturduğu kayıtlardan bağımsız, deterministik bir başlangıç seti.
  const mezitliLedgerCount = await prisma.accountingLedgerEntry.count({ where: { tenantId: mezitli.id } });
  if (mezitliLedgerCount === 0) {
    await prisma.accountingLedgerEntry.create({
      data: {
        tenantId: mezitli.id,
        type: "GELIR",
        category: "Kayıt Ücreti",
        amount: 5000,
        entryDate: new Date(Date.UTC(2026, 6, 1)),
        createdByUserId: branchAdminUser.id,
      },
    });
    await prisma.accountingLedgerEntry.create({
      data: {
        tenantId: mezitli.id,
        type: "GIDER",
        category: "Kira",
        amount: 18000,
        entryDate: new Date(Date.UTC(2026, 6, 5)),
        createdByUserId: branchAdminUser.id,
        // GVK md 94: işyeri kirası, gerçek kişiden kiralanmışsa %20 stopaja
        // tabidir — kesilen pay muhtasar beyanname ile beyan edilir, kalanı
        // kiraya verene net ödenir (bkz. lib/tax.ts, /api/branch/.../vat-summary).
        withholdingRate: 0.2,
      },
    });
    await prisma.accountingLedgerEntry.create({
      data: {
        tenantId: mezitli.id,
        type: "GIDER",
        category: "Büro Malzemesi",
        amount: 1200,
        entryDate: new Date(Date.UTC(2026, 6, 8)),
        createdByUserId: branchAdminUser.id,
        // Standart KDV oranı (%20) — "Kayıt Ücreti"nin aksine bu bir eğitim
        // hizmeti değildir, KDV Kanunu 17/2-b istisnası kapsamına girmez.
        vatRate: 0.2,
      },
    });
  }

  // Normal Kayıt/Ön Kayıt akışını (bkz. apps/web/app/api/branch/enrollments)
  // henüz StudentProfile'a dönüşmemiş bir "aday" ile gösterebilmek için tek
  // bir Ön Kayıt satırı — CRM/lead listesinin boş görünmemesi için.
  const mezitliEnrollmentCount = await prisma.enrollment.count({ where: { tenantId: mezitli.id } });
  if (mezitliEnrollmentCount === 0) {
    await prisma.enrollment.create({
      data: {
        tenantId: mezitli.id,
        type: "ON_KAYIT",
        stage: "ON_KAYIT_ALINDI",
        candidateFullName: "Kerem Şahin",
        candidateGradeLevel: GradeLevel.SINIF_9,
        guardianFullName: "Nur Şahin",
        guardianPhone: "05321234567",
        depositAmount: 2500,
      },
    });
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

  // Basitleştirilmiş bordro örneği (bkz. apps/web/lib/payroll.ts) — brüt
  // maaştan SGK/işsizlik/gelir vergisi/damga vergisi kesintilerini hesaplayıp
  // işveren toplam maliyetini otomatik olarak Muhasebe defterine de yazar
  // (bkz. /api/branch/payroll).
  const payrollPeriod = "2026-07";
  const existingPayroll = await prisma.payrollRecord.findUnique({
    where: { teacherId_period: { teacherId: teacherProfile.id, period: payrollPeriod } },
  });
  if (!existingPayroll) {
    const grossSalary = 30000;
    const breakdown = computePayroll(grossSalary);
    const payrollLedgerEntry = await prisma.accountingLedgerEntry.create({
      data: {
        tenantId: mezitli.id,
        type: "GIDER",
        category: "Personel Maaşı",
        amount: breakdown.employerCost,
        entryDate: new Date(Date.UTC(2026, 6, 31)),
        note: `${teacherUser.firstName} ${teacherUser.lastName} — ${payrollPeriod} bordrosu (işveren toplam maliyeti)`,
        createdByUserId: branchAdminUser.id,
      },
    });
    await prisma.payrollRecord.create({
      data: {
        tenantId: mezitli.id,
        teacherId: teacherProfile.id,
        period: payrollPeriod,
        grossSalary,
        ...breakdown,
        ledgerEntryId: payrollLedgerEntry.id,
        createdByUserId: branchAdminUser.id,
      },
    });
  }

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

  // AI Sınıf Röntgeni'ni (bkz. apps/web/app/api/teacher/exams/[examId]/class-xray)
  // gerçek veriye karşı test edebilmek için 9-A'ya 3 öğrenci daha, bir sınav ve
  // her öğrenci için kazanım bazlı sonuçlar ekleniyor.
  const classXRayStudentDefs = [
    { fullName: "Ahmet Yılmaz", email: "ahmet.yilmaz@ogrenci.seviye360.com", studentNo: "201003" },
    { fullName: "Zeynep Kaya", email: "zeynep.kaya@ogrenci.seviye360.com", studentNo: "201004" },
    { fullName: "Mehmet Demir", email: "mehmet.demir@ogrenci.seviye360.com", studentNo: "201005" },
  ];
  const classXRayStudents = [{ fullName: "Elif Yılmaz", studentProfile: student }];
  for (const def of classXRayStudentDefs) {
    const [firstName, ...rest] = def.fullName.split(" ");
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        tenantId: mezitli.id,
        email: def.email,
        passwordHash,
        role: UserRole.STUDENT,
        firstName,
        lastName: rest.join(" "),
      },
    });
    const profile = await prisma.studentProfile.upsert({
      where: { studentNo: def.studentNo },
      update: {},
      create: {
        tenantId: mezitli.id,
        userId: user.id,
        gradeLevel: GradeLevel.SINIF_9,
        classroomId: classroom.id,
        studentNo: def.studentNo,
      },
    });
    classXRayStudents.push({ fullName: def.fullName, studentProfile: profile });
  }

  const xrayAchievementDefs = [
    { code: "MAT.9.1.2.3", label: "Rasyonel Sayılar" }, // yukarıda oluşturulan `achievement` ile aynı
    { code: "MAT.9.2.1.1", label: "Denklem Kurma" },
    { code: "FIZ.9.3.1.4", label: "Hareket ve Kuvvet" },
    { code: "TUR.9.4.2.1", label: "Paragrafta Anlam" },
  ];
  const xrayAchievements = [];
  for (const def of xrayAchievementDefs) {
    const node =
      def.code === achievement.code
        ? achievement
        : await prisma.curriculumNode.upsert({
            where: { code: def.code },
            update: {},
            create: { type: "ACHIEVEMENT", code: def.code, label: def.label, gradeLevel: 9 },
          });
    xrayAchievements.push(node);
  }

  let xrayExam = await prisma.exam.findFirst({ where: { tenantId: mezitli.id, name: "9. Sınıf Genel Deneme #4" } });
  if (!xrayExam) {
    xrayExam = await prisma.exam.create({
      data: {
        tenantId: mezitli.id,
        name: "9. Sınıf Genel Deneme #4",
        type: ExamType.DENEME,
        scope: ExamScope.BRANCH,
        examDate: new Date(Date.UTC(2026, 6, 15)),
      },
    });
    for (let i = 0; i < xrayAchievements.length; i++) {
      await prisma.examQuestion.create({
        data: { examId: xrayExam.id, orderIndex: i + 1, achievementId: xrayAchievements[i].id },
      });
    }
  }

  // Her öğrencinin her kazanımdaki doğru sayısı (5 soru/kazanım) — ısı
  // haritasındaki CRITICAL/WEAK/STRONG dağılımını gerçekçi göstermek için
  // öğrenciler arasında bilinçli olarak farklılaştırılmıştır.
  const xrayResultDefs: Record<string, number[]> = {
    "201001": [4, 3, 2, 5], // Elif Yılmaz
    "201003": [2, 2, 1, 3], // Ahmet Yılmaz
    "201004": [5, 4, 3, 4], // Zeynep Kaya
    "201005": [3, 1, 2, 2], // Mehmet Demir
  };
  for (const { studentProfile } of classXRayStudents) {
    const correctCounts = xrayResultDefs[studentProfile.studentNo];
    const existingResult = await prisma.examResult.findUnique({
      where: { examId_studentId: { examId: xrayExam.id, studentId: studentProfile.id } },
    });
    if (existingResult) continue;

    const totalQuestions = correctCounts.length * 5;
    const correctCount = correctCounts.reduce((sum, c) => sum + c, 0);
    const wrongCount = totalQuestions - correctCount;
    const netScore = Number((correctCount - wrongCount * 0.25).toFixed(2));

    const examResult = await prisma.examResult.create({
      data: {
        examId: xrayExam.id,
        tenantId: mezitli.id,
        studentId: studentProfile.id,
        correctCount,
        wrongCount,
        emptyCount: 0,
        rawScore: correctCount,
        netScore,
      },
    });

    for (let i = 0; i < xrayAchievements.length; i++) {
      await prisma.studentAchievementResult.create({
        data: {
          examResultId: examResult.id,
          studentId: studentProfile.id,
          achievementId: xrayAchievements[i].id,
          questionCount: 5,
          correctCount: correctCounts[i],
          correctRatio: Number((correctCounts[i] / 5).toFixed(2)),
        },
      });
    }
  }

  console.log("Seed tamamlandı:");
  console.log("  Superadmin (User):", superadminUser.id, "-", superadminUser.email);
  console.log("  Şube 1 (Tenant):", mezitli.id, mezitli.name);
  console.log("  Öğrenci 1 (StudentProfile):", student.id, "-", studentUser.firstName, studentUser.lastName);
  console.log("  Şube Yöneticisi 1 (User):", branchAdminUser.id, "-", branchAdminUser.email);
  console.log("  Şube 2 (Tenant):", cankaya.id, cankaya.name);
  console.log("  Öğrenci 2 (StudentProfile):", cankayaStudent.id, "-", cankayaStudentUser.firstName, cankayaStudentUser.lastName);
  console.log("  Şube Yöneticisi 2 (User):", cankayaAdminUser.id, "-", cankayaAdminUser.email);
  console.log("  Öğretmen (User):", teacherUser.id, "-", teacherUser.email);
  console.log("  Etüt Seansı (StudySession, AI_SUGGESTED):", studySession.id);
  console.log("  Sınav (Exam, AI Sınıf Röntgeni için):", xrayExam.id, "-", xrayExam.name);
  console.log("  9-A sınıfındaki öğrenci sayısı (AI Sınıf Röntgeni için):", classXRayStudents.length);
  console.log("  Bordro örneği (PayrollRecord, 2026-07, Ayşe Demir): brüt ₺30.000 -> net ₺" + computePayroll(30000).netSalary);
  console.log("  Ön Kayıt adayı (Enrollment, henüz StudentProfile'a dönüşmemiş): Kerem Şahin");
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
