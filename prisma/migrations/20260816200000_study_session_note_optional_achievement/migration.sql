ALTER TABLE "StudySession" ADD COLUMN "note" TEXT;
ALTER TABLE "StudySession" ALTER COLUMN "achievementId" DROP NOT NULL;
