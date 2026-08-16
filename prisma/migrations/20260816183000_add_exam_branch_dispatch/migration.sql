CREATE TYPE "BookletDispatchStatus" AS ENUM ('HAZIRLANIYOR', 'BASILIYOR', 'KARGOYA_VERILDI', 'TESLIM_EDILDI');

CREATE TABLE "ExamBranchDispatch" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "BookletDispatchStatus" NOT NULL DEFAULT 'HAZIRLANIYOR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBranchDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamBranchDispatch_examId_tenantId_key" ON "ExamBranchDispatch"("examId", "tenantId");

CREATE INDEX "ExamBranchDispatch_tenantId_idx" ON "ExamBranchDispatch"("tenantId");

ALTER TABLE "ExamBranchDispatch" ADD CONSTRAINT "ExamBranchDispatch_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamBranchDispatch" ADD CONSTRAINT "ExamBranchDispatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
