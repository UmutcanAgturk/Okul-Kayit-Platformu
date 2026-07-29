-- CreateEnum
CREATE TYPE "CrmLeadStage" AS ENUM ('ARANDI', 'GORUSULDU', 'DENEME_SINAVINA_GIRDI', 'KAYIT_OLDU');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateFullName" TEXT NOT NULL,
    "candidateGradeLevel" "GradeLevel" NOT NULL,
    "school" TEXT,
    "guardianFullName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "notes" TEXT,
    "stage" "CrmLeadStage" NOT NULL DEFAULT 'ARANDI',
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmLead_enrollmentId_key" ON "CrmLead"("enrollmentId");

-- CreateIndex
CREATE INDEX "CrmLead_tenantId_stage_idx" ON "CrmLead"("tenantId", "stage");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
