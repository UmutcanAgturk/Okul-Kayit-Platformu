CREATE TYPE "StaffAttendanceStatus" AS ENUM ('GELMEDI', 'IZINLI');

CREATE TABLE "StaffAttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAttendanceRecord_userId_date_key" ON "StaffAttendanceRecord"("userId", "date");

CREATE INDEX "StaffAttendanceRecord_tenantId_date_idx" ON "StaffAttendanceRecord"("tenantId", "date");

ALTER TABLE "StaffAttendanceRecord" ADD CONSTRAINT "StaffAttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffAttendanceRecord" ADD CONSTRAINT "StaffAttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAttendanceRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_and_role_isolation ON "StaffAttendanceRecord"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
