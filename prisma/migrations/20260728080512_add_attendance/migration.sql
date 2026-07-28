-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('VAR', 'GEC', 'IZINLI', 'YOK');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_date_idx" ON "AttendanceRecord"("tenantId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_classroomId_date_idx" ON "AttendanceRecord"("classroomId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_key" ON "AttendanceRecord"("studentId", "date");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS — Classroom/StudentProfile/Exam/ExamResult ile aynı desen: yalnızca
-- düz `tenant_isolation` (rol bazlı kısıtlama YOK). Hangi rolün hangi
-- SATIRLARI görebileceği (öğretmen tüm sınıfı, öğrenci/veli yalnızca kendi
-- kaydı) uygulama katmanında (bkz. app/api/branch/attendance ve
-- app/api/students/[studentId]/attendance) filtrelenir.
-- ---------------------------------------------------------------------------
ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AttendanceRecord"
  USING ("tenantId" = current_setting('app.tenant_id', true));
