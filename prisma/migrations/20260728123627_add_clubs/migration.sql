-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "advisorTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("clubId","studentId")
);

-- CreateIndex
CREATE INDEX "Club_tenantId_idx" ON "Club"("tenantId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_advisorTeacherId_fkey" FOREIGN KEY ("advisorTeacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RowLevelSecurity
-- ClubMembership'te tenantId kolonu yoktur (bkz. şemadaki not — StudentGuardian
-- ile aynı desen) bu yüzden yalnızca Club üzerinde RLS uygulanır.
ALTER TABLE "Club" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Club" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Club"
  USING ("tenantId" = current_setting('app.tenant_id', true));
