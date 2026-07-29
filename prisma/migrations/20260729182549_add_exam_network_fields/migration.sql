-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "eligibleGradeLevels" "GradeLevel"[] DEFAULT ARRAY[]::"GradeLevel"[],
ADD COLUMN     "feePerStudent" DECIMAL(10,2);
