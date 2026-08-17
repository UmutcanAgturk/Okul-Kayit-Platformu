ALTER TABLE "ParentProfile" ADD COLUMN "nationalId" TEXT;
CREATE UNIQUE INDEX "ParentProfile_nationalId_key" ON "ParentProfile"("nationalId");
