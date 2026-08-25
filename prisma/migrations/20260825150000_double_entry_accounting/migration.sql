-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('VARLIK', 'YABANCI_KAYNAK', 'OZKAYNAK', 'GELIR', 'GIDER', 'MALIYET');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('BORC', 'ALACAK');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('MANUEL', 'ACILIS', 'TAHSILAT', 'GIDER', 'FATURA', 'BORDRO', 'KASA_BANKA');

-- DropForeignKey

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "parentCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "studentId" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source" "JournalSource" NOT NULL DEFAULT 'MANUEL',
    "sourceRefId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingAccount_tenantId_type_idx" ON "AccountingAccount"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AccountingAccount_studentId_idx" ON "AccountingAccount"("studentId");

-- CreateIndex
CREATE INDEX "AccountingAccount_supplierId_idx" ON "AccountingAccount"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAccount_tenantId_code_key" ON "AccountingAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_entryDate_idx" ON "JournalEntry"("tenantId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_source_sourceRefId_idx" ON "JournalEntry"("tenantId", "source", "sourceRefId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_no_key" ON "JournalEntry"("tenantId", "no");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- RLS: Çift taraflı muhasebe tabloları — tenant + rol izolasyonu
-- (yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING). JournalLine tenant sütunu
-- taşımadığından üst kayıt (JournalEntry) üzerinden EXISTS ile kapsanır.
-- ---------------------------------------------------------------------------
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "Supplier"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );

ALTER TABLE "AccountingAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "AccountingAccount"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );

ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "JournalEntry"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );

ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "JournalLine"
  USING (
    EXISTS (
      SELECT 1 FROM "JournalEntry" je
      WHERE je."id" = "JournalLine"."journalEntryId"
        AND je."tenantId" = current_setting('app.tenant_id', true)
    )
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
