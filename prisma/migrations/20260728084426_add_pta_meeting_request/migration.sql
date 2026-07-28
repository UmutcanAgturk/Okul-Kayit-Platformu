-- CreateEnum
CREATE TYPE "PtaRequestStatus" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- CreateTable
CREATE TABLE "PtaMeetingRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "topic" TEXT,
    "status" "PtaRequestStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PtaMeetingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PtaMeetingRequest_tenantId_createdAt_idx" ON "PtaMeetingRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PtaMeetingRequest_studentId_idx" ON "PtaMeetingRequest"("studentId");

-- CreateIndex
CREATE INDEX "PtaMeetingRequest_teacherId_status_idx" ON "PtaMeetingRequest"("teacherId", "status");

-- AddForeignKey
ALTER TABLE "PtaMeetingRequest" ADD CONSTRAINT "PtaMeetingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtaMeetingRequest" ADD CONSTRAINT "PtaMeetingRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtaMeetingRequest" ADD CONSTRAINT "PtaMeetingRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "PtaMeetingRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PtaMeetingRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PtaMeetingRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true));
