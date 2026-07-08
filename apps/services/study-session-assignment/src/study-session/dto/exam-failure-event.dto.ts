import { IsIn, IsISO8601, IsNumber, IsString, Max, Min } from "class-validator";

/**
 * Ölçme/Değerlendirme (Assessment) mikroservisinin, bir öğrencinin belirli bir
 * kazanımda kritik/zayıf performans gösterdiğini tespit ettiğinde Kafka'ya
 * yayınladığı olay (event) sözleşmesi.
 *
 * Topic: "exam.achievement-failure.detected"
 */
export class ExamAchievementFailureEventDto {
  @IsString()
  eventId!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  examId!: string;

  @IsString()
  examResultId!: string;

  @IsString()
  studentId!: string;

  @IsString()
  achievementId!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  correctRatio!: number;

  @IsIn(["CRITICAL", "WEAK"])
  masteryLevel!: "CRITICAL" | "WEAK";

  @IsISO8601()
  occurredAt!: string;
}
