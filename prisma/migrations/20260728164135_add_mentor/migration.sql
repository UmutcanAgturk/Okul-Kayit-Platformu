-- CreateEnum
CREATE TYPE "MentorRequestStatus" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI', 'TAMAMLANDI');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "mentorTeacherId" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "isMentor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MentorRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mentorTeacherId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "MentorRequestStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorRequest_tenantId_createdAt_idx" ON "MentorRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorRequest_studentId_idx" ON "MentorRequest"("studentId");

-- CreateIndex
CREATE INDEX "MentorRequest_mentorTeacherId_status_idx" ON "MentorRequest"("mentorTeacherId", "status");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_mentorTeacherId_fkey" FOREIGN KEY ("mentorTeacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_mentorTeacherId_fkey" FOREIGN KEY ("mentorTeacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
