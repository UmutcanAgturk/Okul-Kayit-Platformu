-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('ANASINIFI_3_YAS', 'ANASINIFI_4_YAS', 'ANASINIFI_5_YAS', 'SINIF_1', 'SINIF_2', 'SINIF_3', 'SINIF_4', 'SINIF_5', 'SINIF_6', 'SINIF_7', 'SINIF_8', 'SINIF_9', 'SINIF_10', 'SINIF_11', 'SINIF_12', 'MEZUN');

-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('GENEL_MERKEZ', 'SUBE', 'BOLUM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR', 'ACCOUNTING', 'TEACHER', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('ON_KAYIT', 'NORMAL_KAYIT');

-- CreateEnum
CREATE TYPE "EnrollmentStage" AS ENUM ('ON_KAYIT_ALINDI', 'SOZLESME_BEKLENIYOR', 'ODEME_PLANI_OLUSTURULDU', 'KAYIT_TAMAMLANDI', 'IPTAL_EDILDI');

-- CreateEnum
CREATE TYPE "CurriculumNodeType" AS ENUM ('SUBJECT', 'UNIT', 'TOPIC', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "ExamScope" AS ENUM ('BRANCH', 'NETWORK');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('DENEME', 'YAZILI', 'VIP_OLCME');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('AI_SUGGESTED', 'TEACHER_APPROVED', 'TEACHER_REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudySessionSource" AS ENUM ('AI_AUTO_ASSIGNED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('KREDI_KARTI', 'BANKA_HAVALESI', 'NAKIT');

-- CreateEnum
CREATE TYPE "AccountingEntryType" AS ENUM ('GELIR', 'GIDER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "classroomId" TEXT,
    "targetGoal" TEXT,
    "studentNo" TEXT NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "studentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "isBillingResponsible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentId","parentId")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EnrollmentType" NOT NULL DEFAULT 'ON_KAYIT',
    "stage" "EnrollmentStage" NOT NULL DEFAULT 'ON_KAYIT_ALINDI',
    "candidateFullName" TEXT NOT NULL,
    "candidateGradeLevel" "GradeLevel" NOT NULL,
    "guardianFullName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "targetClassroomId" TEXT,
    "depositAmount" DECIMAL(10,2),
    "contractSignedAt" TIMESTAMP(3),
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumNode" (
    "id" TEXT NOT NULL,
    "type" "CurriculumNodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "CurriculumNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExamType" NOT NULL,
    "scope" "ExamScope" NOT NULL,
    "bookletTypes" TEXT[] DEFAULT ARRAY['A', 'B', 'C', 'D']::TEXT[],
    "examDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "achievementId" TEXT NOT NULL,
    "irtDifficulty" DOUBLE PRECISION,
    "irtDiscrimination" DOUBLE PRECISION,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seatingRoomId" TEXT,
    "seatNo" TEXT,
    "bookletType" TEXT,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "emptyCount" INTEGER NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "netScore" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievementResult" (
    "id" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "correctRatio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StudentAchievementResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeacherAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'AI_SUGGESTED',
    "source" "StudySessionSource" NOT NULL DEFAULT 'AI_AUTO_ASSIGNED',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" TEXT NOT NULL DEFAULT 'ParamPOS',
    "providerTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ParamPOS',
    "maskedCardNumber" TEXT,
    "providerCardToken" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AccountingEntryType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "relatedInstallmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Tenant_parentId_idx" ON "Tenant"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE INDEX "TeacherProfile_branch_idx" ON "TeacherProfile"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentNo_key" ON "StudentProfile"("studentNo");

-- CreateIndex
CREATE INDEX "StudentProfile_classroomId_idx" ON "StudentProfile"("classroomId");

-- CreateIndex
CREATE INDEX "StudentProfile_gradeLevel_idx" ON "StudentProfile"("gradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE INDEX "Classroom_tenantId_gradeLevel_idx" ON "Classroom"("tenantId", "gradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_tenantId_name_key" ON "Classroom"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_key" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_stage_idx" ON "Enrollment"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumNode_code_key" ON "CurriculumNode"("code");

-- CreateIndex
CREATE INDEX "CurriculumNode_parentId_idx" ON "CurriculumNode"("parentId");

-- CreateIndex
CREATE INDEX "CurriculumNode_type_gradeLevel_idx" ON "CurriculumNode"("type", "gradeLevel");

-- CreateIndex
CREATE INDEX "Exam_tenantId_examDate_idx" ON "Exam"("tenantId", "examDate");

-- CreateIndex
CREATE INDEX "ExamQuestion_achievementId_idx" ON "ExamQuestion"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_orderIndex_key" ON "ExamQuestion"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExamResult_tenantId_examId_idx" ON "ExamResult"("tenantId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");

-- CreateIndex
CREATE INDEX "StudentAchievementResult_studentId_achievementId_idx" ON "StudentAchievementResult"("studentId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievementResult_examResultId_achievementId_key" ON "StudentAchievementResult"("examResultId", "achievementId");

-- CreateIndex
CREATE INDEX "TeacherAvailabilitySlot_teacherId_dayOfWeek_isBooked_idx" ON "TeacherAvailabilitySlot"("teacherId", "dayOfWeek", "isBooked");

-- CreateIndex
CREATE INDEX "StudySession_tenantId_teacherId_scheduledStart_idx" ON "StudySession"("tenantId", "teacherId", "scheduledStart");

-- CreateIndex
CREATE INDEX "StudySession_studentId_status_idx" ON "StudySession"("studentId", "status");

-- CreateIndex
CREATE INDEX "PaymentInstallment_tenantId_status_dueDate_idx" ON "PaymentInstallment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "PaymentInstallment_studentId_installmentNo_idx" ON "PaymentInstallment"("studentId", "installmentNo");

-- CreateIndex
CREATE INDEX "PaymentMethod_tenantId_studentId_idx" ON "PaymentMethod"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "AccountingLedgerEntry_tenantId_entryDate_idx" ON "AccountingLedgerEntry"("tenantId", "entryDate");

-- CreateIndex
CREATE INDEX "AccountingLedgerEntry_tenantId_type_idx" ON "AccountingLedgerEntry"("tenantId", "type");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_targetClassroomId_fkey" FOREIGN KEY ("targetClassroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumNode" ADD CONSTRAINT "CurriculumNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CurriculumNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "CurriculumNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievementResult" ADD CONSTRAINT "StudentAchievementResult_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievementResult" ADD CONSTRAINT "StudentAchievementResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievementResult" ADD CONSTRAINT "StudentAchievementResult_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "CurriculumNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailabilitySlot" ADD CONSTRAINT "TeacherAvailabilitySlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "CurriculumNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
