-- DropForeignKey
ALTER TABLE "PayrollRecord" DROP CONSTRAINT "PayrollRecord_teacherId_fkey";

-- AlterTable
ALTER TABLE "PayrollRecord" ADD COLUMN     "staffProfileId" TEXT,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "salary" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_tenantId_idx" ON "StaffProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_staffProfileId_period_key" ON "PayrollRecord"("staffProfileId", "period");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Veri bütünlüğü — PayrollRecord tam olarak biri (teacherId XOR staffProfileId)
-- dolu olmalı; uygulama katmanının yanı sıra veritabanı seviyesinde de garanti
-- edilir.
-- ---------------------------------------------------------------------------
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_teacher_or_staff_check"
  CHECK (num_nonnulls("teacherId", "staffProfileId") = 1);

-- ---------------------------------------------------------------------------
-- RLS — StaffProfile, PayrollRecord/AccountingLedgerEntry ile aynı desen:
-- tenant izolasyonuna ek olarak yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING
-- sorgulayabilir (maaş verisi hassastır).
-- ---------------------------------------------------------------------------
ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "StaffProfile"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
