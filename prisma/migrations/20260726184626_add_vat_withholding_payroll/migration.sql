-- AlterTable
ALTER TABLE "AccountingLedgerEntry" ADD COLUMN     "vatRate" DECIMAL(5,4),
ADD COLUMN     "withholdingRate" DECIMAL(5,4);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "sgkEmployeeShare" DECIMAL(10,2) NOT NULL,
    "unemploymentEmployeeShare" DECIMAL(10,2) NOT NULL,
    "incomeTaxWithheld" DECIMAL(10,2) NOT NULL,
    "stampDutyWithheld" DECIMAL(10,2) NOT NULL,
    "netSalary" DECIMAL(10,2) NOT NULL,
    "sgkEmployerShare" DECIMAL(10,2) NOT NULL,
    "unemploymentEmployerShare" DECIMAL(10,2) NOT NULL,
    "employerCost" DECIMAL(10,2) NOT NULL,
    "ledgerEntryId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_ledgerEntryId_key" ON "PayrollRecord"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "PayrollRecord_tenantId_period_idx" ON "PayrollRecord"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_teacherId_period_key" ON "PayrollRecord"("teacherId", "period");

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "AccountingLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS — PayrollRecord, AccountingLedgerEntry ile aynı desen: tenant izolasyonuna
-- ek olarak yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING sorgulayabilir (maaş
-- verisi hassastır; TEACHER kendi bordrosunu bile bu tablo üzerinden göremez).
-- ---------------------------------------------------------------------------
ALTER TABLE "PayrollRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "PayrollRecord"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
