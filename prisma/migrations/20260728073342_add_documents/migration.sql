-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('TAHSILAT', 'ODEME');

-- CreateEnum
CREATE TYPE "ReceiptMethod" AS ENUM ('KREDI_KARTI', 'BANKA_HAVALESI', 'NAKIT', 'SENET');

-- CreateEnum
CREATE TYPE "PromissoryNoteStatus" AS ENUM ('ODENMEDI', 'ODENDI');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerTaxNo" TEXT,
    "buyerAddress" TEXT,
    "items" JSONB NOT NULL,
    "kdvRate" DECIMAL(5,4),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "kdvAmount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "personName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "ReceiptMethod" NOT NULL,
    "description" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromissoryNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "debtorName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "status" "PromissoryNoteStatus" NOT NULL DEFAULT 'ODENMEDI',
    "paidAt" TIMESTAMP(3),
    "studentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromissoryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_no_key" ON "Invoice"("tenantId", "no");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_idx" ON "Receipt"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_tenantId_no_key" ON "Receipt"("tenantId", "no");

-- CreateIndex
CREATE INDEX "PromissoryNote_tenantId_idx" ON "PromissoryNote"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PromissoryNote_tenantId_no_key" ON "PromissoryNote"("tenantId", "no");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "PromissoryNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "PromissoryNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS — Invoice/Receipt/PromissoryNote, AccountingLedgerEntry/PayrollRecord/
-- StaffProfile ile aynı desen: tenant izolasyonuna ek olarak yalnızca
-- SUPERADMIN/BRANCH_ADMIN/ACCOUNTING sorgulayabilir (finansal belgelerdir).
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "Invoice"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );

ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "Receipt"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );

ALTER TABLE "PromissoryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromissoryNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "PromissoryNote"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
