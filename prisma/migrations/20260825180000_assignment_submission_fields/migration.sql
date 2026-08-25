-- DropForeignKey

-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "dataUrl" TEXT,
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedByUserId" TEXT,
ADD COLUMN     "mimeType" TEXT;

-- AddForeignKey


-- RLS: AssignmentSubmission tenant sütunu taşımaz; üst kayıt (Assignment)
-- üzerinden tenant izolasyonu uygulanır (JournalLine deseniyle aynı).
ALTER TABLE "AssignmentSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentSubmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AssignmentSubmission"
  USING (
    EXISTS (
      SELECT 1 FROM "Assignment" a
      WHERE a."id" = "AssignmentSubmission"."assignmentId"
        AND a."tenantId" = current_setting('app.tenant_id', true)
    )
  );
