-- CreateEnum
CREATE TYPE "DisciplineType" AS ENUM ('OLUMLU', 'OLUMSUZ');

-- CreateTable
CREATE TABLE "DisciplineRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DisciplineType" NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "points" INTEGER NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisciplineRecord_tenantId_createdAt_idx" ON "DisciplineRecord"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DisciplineRecord_studentId_idx" ON "DisciplineRecord"("studentId");

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS — AttendanceRecord ile aynı desen: yalnızca düz `tenant_isolation`
-- (rol bazlı kısıtlama YOK). Hangi rolün hangi SATIRLARI görebileceği
-- uygulama katmanında (bkz. app/api/branch/discipline ve
-- app/api/students/[studentId]/discipline) filtrelenir.
-- ---------------------------------------------------------------------------
ALTER TABLE "DisciplineRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplineRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DisciplineRecord"
  USING ("tenantId" = current_setting('app.tenant_id', true));
