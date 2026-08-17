-- CreateTable
CREATE TABLE "ExamResultAnswer" (
    "id" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN,

    CONSTRAINT "ExamResultAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamResultAnswer_examResultId_idx" ON "ExamResultAnswer"("examResultId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResultAnswer_examResultId_questionId_key" ON "ExamResultAnswer"("examResultId", "questionId");

-- AddForeignKey
ALTER TABLE "ExamResultAnswer" ADD CONSTRAINT "ExamResultAnswer_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultAnswer" ADD CONSTRAINT "ExamResultAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
