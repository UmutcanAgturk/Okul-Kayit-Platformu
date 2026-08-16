CREATE TYPE "InstitutionPaymentMethodType" AS ENUM ('KREDI_KARTI', 'BANKA_HAVALESI', 'NAKIT', 'SENET');

CREATE TABLE "InstitutionPaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "InstitutionPaymentMethodType" NOT NULL,
    "label" TEXT NOT NULL,
    "extra" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstitutionPaymentMethod_tenantId_idx" ON "InstitutionPaymentMethod"("tenantId");

ALTER TABLE "InstitutionPaymentMethod" ADD CONSTRAINT "InstitutionPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InstitutionPaymentMethod" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_and_role_isolation ON "InstitutionPaymentMethod"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
