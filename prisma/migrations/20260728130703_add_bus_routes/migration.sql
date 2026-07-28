-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "busRouteId" TEXT;

-- CreateTable
CREATE TABLE "BusRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "capacity" INTEGER NOT NULL,
    "stops" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusRoute_tenantId_idx" ON "BusRoute"("tenantId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_busRouteId_fkey" FOREIGN KEY ("busRouteId") REFERENCES "BusRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusRoute" ADD CONSTRAINT "BusRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "BusRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusRoute" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BusRoute"
  USING ("tenantId" = current_setting('app.tenant_id', true));
