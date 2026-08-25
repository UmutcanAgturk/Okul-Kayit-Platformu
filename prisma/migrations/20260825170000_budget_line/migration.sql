-- DropForeignKey

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "plannedAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_year_idx" ON "BudgetLine"("tenantId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_tenantId_year_accountCode_key" ON "BudgetLine"("tenantId", "year", "accountCode");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: Bütçe — tenant + rol (SUPERADMIN/BRANCH_ADMIN/ACCOUNTING)
ALTER TABLE "BudgetLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "BudgetLine"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
