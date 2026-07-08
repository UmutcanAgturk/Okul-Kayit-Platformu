import { Controller, Logger, UsePipes, ValidationPipe } from "@nestjs/common";
import { Ctx, KafkaContext, MessagePattern, Payload } from "@nestjs/microservices";
import { StudySessionService } from "../study-session.service";
import { ExamAchievementFailureEventDto } from "../dto/exam-failure-event.dto";

/**
 * Assessment (Ölçme) mikroservisinden Kafka üzerinden yayınlanan
 * "exam.achievement-failure.detected" olayını dinler.
 *
 * RabbitMQ kullanan dağıtımlar için: @nestjs/microservices RMQ transport'u
 * birebir aynı DTO ve servis katmanıyla, yalnızca bu controller'ın
 * @EventPattern kaynağı değiştirilerek yeniden kullanılabilir.
 */
@Controller()
export class ExamFailureListener {
  private readonly logger = new Logger(ExamFailureListener.name);

  constructor(private readonly studySessionService: StudySessionService) {}

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @MessagePattern("exam.achievement-failure.detected")
  async onAchievementFailureDetected(
    @Payload() event: ExamAchievementFailureEventDto,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const message = context.getMessage();
    this.logger.log(
      `Olay alındı: eventId=${event.eventId} student=${event.studentId} kazanım=${event.achievementId} offset=${message.offset}`,
    );

    try {
      await this.studySessionService.assignStudySessionForFailure(event);
    } catch (error) {
      this.logger.error(
        `Etüt ataması başarısız: eventId=${event.eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Kafka consumer'ı at-least-once garantisiyle çalışır; işlenemeyen olay
      // Dead Letter Topic'e (exam.achievement-failure.dlq) yönlendirilir.
      throw error;
    }
  }
}
