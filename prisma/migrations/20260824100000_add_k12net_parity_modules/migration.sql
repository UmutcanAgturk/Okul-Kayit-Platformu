-- CreateEnum
CREATE TYPE "SurveyAudience" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'STAFF', 'ALL');

-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('TEXT', 'SINGLE', 'MULTI', 'RATING');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MedicalSeverity" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ACIK', 'KAPALI');

-- DropForeignKey

-- AlterTable

-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "barcode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT,
    "gradeLevels" TEXT[],
    "items" TEXT[],
    "expectedParticipation" INTEGER,
    "note" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "patientName" TEXT,
    "severity" "MedicalSeverity" NOT NULL DEFAULT 'DUSUK',
    "description" TEXT,
    "notes" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'ACIK',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScreening" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "targetGrades" TEXT[],
    "scheduledDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumnus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "studentNo" TEXT,
    "graduationYear" TEXT,
    "university" TEXT,
    "employment" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumnus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audience" "SurveyAudience" NOT NULL DEFAULT 'ALL',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL DEFAULT 'SINGLE',
    "options" TEXT[],

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentUserId" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "classroomId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "attachments" TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "submittedAt" TIMESTAMP(3),
    "note" TEXT,
    "grade" TEXT,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "assigneeUserId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "status" "TaskApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "TaskApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounselingCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "subjectName" TEXT,
    "reason" TEXT NOT NULL,
    "counselors" TEXT[],
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'ACIK',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounselingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attended" BOOLEAN,

    CONSTRAINT "EventParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "reason" TEXT,
    "hostName" TEXT,
    "phone" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" TEXT,
    "location" TEXT,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "credit" INTEGER,
    "weeklyHours" INTEGER,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "gradeLevels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromYearLabel" TEXT NOT NULL,
    "toYearLabel" TEXT NOT NULL,
    "runByUserId" TEXT,
    "promotedCount" INTEGER NOT NULL DEFAULT 0,
    "graduatedCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealItem_tenantId_idx" ON "MealItem"("tenantId");

-- CreateIndex
CREATE INDEX "MenuPlan_tenantId_date_idx" ON "MenuPlan"("tenantId", "date");

-- CreateIndex
CREATE INDEX "MedicalCase_tenantId_idx" ON "MedicalCase"("tenantId");

-- CreateIndex
CREATE INDEX "MedicalCase_studentId_idx" ON "MedicalCase"("studentId");

-- CreateIndex
CREATE INDEX "HealthScreening_tenantId_idx" ON "HealthScreening"("tenantId");

-- CreateIndex
CREATE INDEX "Alumnus_tenantId_idx" ON "Alumnus"("tenantId");

-- CreateIndex
CREATE INDEX "Survey_tenantId_idx" ON "Survey"("tenantId");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_idx" ON "Assignment"("tenantId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX "Task_assigneeUserId_idx" ON "Task"("assigneeUserId");

-- CreateIndex
CREATE INDEX "TaskApproval_taskId_idx" ON "TaskApproval"("taskId");

-- CreateIndex
CREATE INDEX "TaskApproval_approverUserId_idx" ON "TaskApproval"("approverUserId");

-- CreateIndex
CREATE INDEX "CounselingCase_tenantId_idx" ON "CounselingCase"("tenantId");

-- CreateIndex
CREATE INDEX "CounselingCase_studentId_idx" ON "CounselingCase"("studentId");

-- CreateIndex
CREATE INDEX "SchoolEvent_tenantId_idx" ON "SchoolEvent"("tenantId");

-- CreateIndex
CREATE INDEX "EventParticipation_eventId_idx" ON "EventParticipation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipation_eventId_studentId_key" ON "EventParticipation"("eventId", "studentId");

-- CreateIndex
CREATE INDEX "VisitorLog_tenantId_idx" ON "VisitorLog"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_startAt_idx" ON "CalendarEvent"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "Course_tenantId_idx" ON "Course"("tenantId");

-- CreateIndex
CREATE INDEX "AcademicYear_tenantId_idx" ON "AcademicYear"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_tenantId_label_key" ON "AcademicYear"("tenantId", "label");

-- CreateIndex
CREATE INDEX "PromotionRun_tenantId_idx" ON "PromotionRun"("tenantId");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPlan" ADD CONSTRAINT "MenuPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScreening" ADD CONSTRAINT "HealthScreening_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumnus" ADD CONSTRAINT "Alumnus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskApproval" ADD CONSTRAINT "TaskApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingCase" ADD CONSTRAINT "CounselingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipation" ADD CONSTRAINT "EventParticipation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchoolEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorLog" ADD CONSTRAINT "VisitorLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Row-Level Security — tüm tenant-scoped tablolar için tenant_isolation.
-- Sağlık (MedicalCase) ve Rehberlik (CounselingCase) hassas veri içerir:
-- tenant_and_role_isolation ile yalnızca yönetim/rehberlik rollerine açık.
-- Alt (join) tablolar (SurveyQuestion/SurveyResponse/AssignmentSubmission/
-- TaskApproval/EventParticipation) tenantId taşımaz → RLS yok (parent korur).
-- GRANT'lar ALTER DEFAULT PRIVILEGES ile otomatiktir (bkz. base RLS migration).
-- ---------------------------------------------------------------------------
ALTER TABLE "MealItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MealItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MealItem"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "MenuPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MenuPlan"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "HealthScreening" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HealthScreening" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "HealthScreening"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "Alumnus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alumnus" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Alumnus"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "Survey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Survey" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Survey"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Assignment"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Task"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "SchoolEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SchoolEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "VisitorLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisitorLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "VisitorLog"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CalendarEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Course"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "AcademicYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicYear" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AcademicYear"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "PromotionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromotionRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PromotionRun"
  USING ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "MedicalCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicalCase" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "MedicalCase"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR')
  );
ALTER TABLE "CounselingCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CounselingCase" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "CounselingCase"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR')
  );
