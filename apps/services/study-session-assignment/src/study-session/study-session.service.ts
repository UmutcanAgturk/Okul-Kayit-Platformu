import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";
import { PrismaService } from "../prisma/prisma.service";
import { TeacherAvailabilityService } from "./smart-matching/teacher-availability.service";
import { ExamAchievementFailureEventDto } from "./dto/exam-failure-event.dto";

const STUDY_SESSION_ASSIGNED_TOPIC = "study-session.ai-assigned";
const STUDY_SESSION_ASSIGNMENT_FAILED_TOPIC = "study-session.assignment-failed";

@Injectable()
export class StudySessionService {
  private readonly logger = new Logger(StudySessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAvailability: TeacherAvailabilityService,
    @Inject("STUDY_SESSION_EVENTS") private readonly kafkaClient: ClientKafka,
  ) {}

  /**
   * "exam.achievement-failure.detected" olayına verilen ana tepki.
   * Kazanımın branşını bulur, uygun zümre öğretmeninin en iyi boş saatini
   * Smart Matching motoruyla seçer ve VIP Etüt (StudySession) rezervasyonunu
   * atomik biçimde oluşturur.
   */
  async assignStudySessionForFailure(event: ExamAchievementFailureEventDto): Promise<void> {
    const alreadyHandled = await this.prisma.studySession.findFirst({
      where: {
        studentId: event.studentId,
        achievementId: event.achievementId,
        status: { in: ["AI_SUGGESTED", "TEACHER_APPROVED"] },
      },
    });

    if (alreadyHandled) {
      this.logger.log(
        `Öğrenci ${event.studentId} için ${event.achievementId} kazanımına dair etüt zaten mevcut, atlanıyor.`,
      );
      return;
    }

    const branch = await this.resolveAchievementBranch(event.achievementId);
    if (!branch) {
      this.logger.error(`Kazanım ${event.achievementId} için branş çözümlenemedi.`);
      return;
    }

    const bestSlot = await this.teacherAvailability.findBestSlot(event.tenantId, branch);

    if (!bestSlot) {
      await this.kafkaClient.emit(STUDY_SESSION_ASSIGNMENT_FAILED_TOPIC, {
        tenantId: event.tenantId,
        studentId: event.studentId,
        achievementId: event.achievementId,
        reason: "NO_AVAILABLE_TEACHER_SLOT",
        occurredAt: new Date().toISOString(),
      });
      return;
    }

    const { start, end } = this.teacherAvailability.resolveNextOccurrence(
      bestSlot.dayOfWeek,
      bestSlot.startTime,
      bestSlot.endTime,
    );

    const studySession = await this.prisma.$transaction(async (tx) => {
      const slot = await tx.teacherAvailabilitySlot.updateMany({
        where: { id: bestSlot.slotId, isBooked: false },
        data: { isBooked: true },
      });

      // Aynı slota eşzamanlı iki event yarışırsa (race condition) ikinci istek burada durur.
      if (slot.count === 0) {
        throw new Error("SLOT_ALREADY_BOOKED");
      }

      return tx.studySession.create({
        data: {
          tenantId: event.tenantId,
          studentId: event.studentId,
          teacherId: bestSlot.teacherId,
          achievementId: event.achievementId,
          status: "AI_SUGGESTED",
          source: "AI_AUTO_ASSIGNED",
          scheduledStart: start,
          scheduledEnd: end,
        },
      });
    }).catch(async (err: Error) => {
      if (err.message === "SLOT_ALREADY_BOOKED") {
        this.logger.warn(`Slot ${bestSlot.slotId} yarışta kaybedildi, yeniden deneniyor.`);
        return this.assignStudySessionForFailure(event).then(() => null);
      }
      throw err;
    });

    if (!studySession) return;

    await this.kafkaClient.emit(STUDY_SESSION_ASSIGNED_TOPIC, {
      studySessionId: studySession.id,
      tenantId: event.tenantId,
      teacherId: bestSlot.teacherId,
      studentId: event.studentId,
      achievementId: event.achievementId,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
    });

    this.logger.log(
      `VIP Etüt oluşturuldu: öğrenci=${event.studentId} öğretmen=${bestSlot.teacherId} başlangıç=${start.toISOString()}`,
    );
  }

  /** Kazanım ağacında yukarı doğru çıkarak en üst SUBJECT düğümünün adını (branş) bulur. */
  private async resolveAchievementBranch(achievementId: string): Promise<string | null> {
    let currentId: string | null = achievementId;
    const maxDepth = 6;

    for (let depth = 0; depth < maxDepth && currentId; depth++) {
      const node = await this.prisma.curriculumNode.findUnique({ where: { id: currentId } });
      if (!node) return null;
      if (node.type === "SUBJECT") return node.label;
      currentId = node.parentId;
    }

    return null;
  }
}
