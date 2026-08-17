// Tüm demo verilerini kalıcı olarak siler ve sistemi TEK bir SUPERADMIN
// hesabıyla gerçek kullanıma hazır boş bir kuruluma döndürür. Tek seferlik
// bir bakım script'idir — CI/test script'lerinin aksine tekrar tekrar
// çalıştırılması BEKLENMEZ (her çalıştırmada mevcut SUPERADMIN'i de siler ve
// yeniden oluşturur).
import { PrismaClient, TenantType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NEW_SUPERADMIN_EMAIL = "SeviyeEgitimAdmin";
const NEW_SUPERADMIN_PASSWORD = "Seviye2014_2027.";

const TABLES = [
  "User", "Tenant", "TeacherProfile", "StudentGuardian", "CurriculumNode",
  "StudentAchievementResult", "TeacherAvailabilitySlot", "ParentProfile",
  "AccountingLedgerEntry", "ExamResult", "Exam", "PaymentInstallment",
  "Classroom", "PaymentMethod", "StudySession", "ExamQuestion", "Enrollment",
  "StudentProfile", "UserSession", "StaffProfile", "PayrollRecord", "Invoice",
  "Receipt", "PromissoryNote", "AttendanceRecord", "DisciplineRecord",
  "PtaMeetingRequest", "ClubMembership", "Club", "AuditLogEntry", "Message",
  "BusRoute", "QuizAttempt", "CrmLead", "MessageRecipient", "MentorRequest",
  "TimetableSlot", "MessageTemplate", "InstitutionPaymentMethod",
  "PaymentReceipt", "ExamBranchDispatch", "MessageAttachment",
  "ExamResultAnswer", "StaffAttendanceRecord",
];

async function main() {
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE;`);
  console.log(`Silindi: ${TABLES.length} tablo.`);

  // HQ Sınav Uygulaması (Genel Sınav Merkezi) gibi ekranlar GENEL_MERKEZ
  // tipinde bir tenant satırının var olduğunu varsayıyor (bkz.
  // app/api/hq/exams/route.ts) — boş bırakılamaz.
  const genelMerkez = await prisma.tenant.create({
    data: { name: "Seviye 360 Genel Merkez", code: "GENEL-MERKEZ", type: TenantType.GENEL_MERKEZ },
  });
  console.log(`Genel Merkez tenant'ı oluşturuldu: ${genelMerkez.id}`);

  const passwordHash = await bcrypt.hash(NEW_SUPERADMIN_PASSWORD, 10);
  const superadmin = await prisma.user.create({
    data: {
      tenantId: null,
      email: NEW_SUPERADMIN_EMAIL,
      passwordHash,
      role: UserRole.SUPERADMIN,
      firstName: "Seviye Eğitim",
      lastName: "Genel Merkez",
    },
  });
  console.log(`Yeni SUPERADMIN oluşturuldu: ${superadmin.email} (id: ${superadmin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
