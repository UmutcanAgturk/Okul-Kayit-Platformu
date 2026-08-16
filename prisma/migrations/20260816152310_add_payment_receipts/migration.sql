-- CreateEnum
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "note" TEXT,
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentReceipt_tenantId_status_idx" ON "PaymentReceipt"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentReceipt_studentId_idx" ON "PaymentReceipt"("studentId");

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "PaymentInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (bkz. prisma/rls/README.md) — MessageTemplate ile aynı desen: yalnızca
-- tenant izolasyonu, rol kısıtlaması uygulama katmanında (route'ta) yapılır
-- (PARENT kendi öğrencisi için oluşturur, BRANCH_ADMIN/ACCOUNTING onaylar).
ALTER TABLE "PaymentReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentReceipt" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "PaymentReceipt"
  USING ("tenantId" = current_setting('app.tenant_id', true));
