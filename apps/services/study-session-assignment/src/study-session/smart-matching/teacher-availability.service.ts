import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface SlotCandidate {
  slotId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Bu öğretmene bu hafta zaten atanmış aktif VIP Etüt sayısı — iş yükü dengelemesi için. */
  teacherWeeklyLoad: number;
  score: number;
}

/**
 * Timetabling tabanlı "Smart Matching" motoru.
 *
 * Skorlama, üç sinyali dengeler:
 *  - Yakınlık: en yakın günkü boş saat daha yüksek puan alır.
 *  - Adil dağılım: bu hafta zaten çok etüt üstlenmiş öğretmenin puanı düşürülür
 *    (aynı zümredeki tüm öğretmenlere adil şekilde yük dağıtmak için).
 *  - Zümre uygunluğu: yalnızca kazanımın ait olduğu branştaki öğretmenler aday olur.
 */
@Injectable()
export class TeacherAvailabilityService {
  private readonly logger = new Logger(TeacherAvailabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findBestSlot(tenantId: string, branch: string): Promise<SlotCandidate | null> {
    const candidates = await this.buildCandidates(tenantId, branch);

    if (candidates.length === 0) {
      this.logger.warn(`Uygun etüt saati bulunamadı: tenant=${tenantId} branş=${branch}`);
      return null;
    }

    return candidates.reduce((best, current) => (current.score > best.score ? current : best));
  }

  private async buildCandidates(tenantId: string, branch: string): Promise<SlotCandidate[]> {
    const openSlots = await this.prisma.teacherAvailabilitySlot.findMany({
      where: {
        isBooked: false,
        teacher: {
          branch,
          user: { tenantId },
        },
      },
      include: { teacher: true },
    });

    const weekStart = this.startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const workloadByTeacher = await this.prisma.studySession.groupBy({
      by: ["teacherId"],
      where: {
        tenantId,
        status: { in: ["AI_SUGGESTED", "TEACHER_APPROVED"] },
        scheduledStart: { gte: weekStart, lt: weekEnd },
      },
      _count: { _all: true },
    });

    const workloadMap = new Map(workloadByTeacher.map((w) => [w.teacherId, w._count._all]));

    return openSlots.map((slot) => {
      const teacherWeeklyLoad = workloadMap.get(slot.teacherId) ?? 0;
      const proximityScore = this.proximityScore(slot.dayOfWeek, slot.startTime);
      const loadPenalty = teacherWeeklyLoad * 8; // her mevcut etüt puanı 8 azaltır

      return {
        slotId: slot.id,
        teacherId: slot.teacherId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teacherWeeklyLoad,
        score: proximityScore - loadPenalty,
      };
    });
  }

  /** dayOfWeek + startTime'ın bugünden itibaren gelen en yakın somut tarihini üretir. */
  resolveNextOccurrence(dayOfWeek: number, startTime: string, endTime: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    const currentDow = (now.getDay() + 6) % 7; // JS: 0=Pazar -> modelde 0=Pazartesi'ye çevir
    let daysAhead = (dayOfWeek - currentDow + 7) % 7;
    if (daysAhead === 0) daysAhead = 7; // bugünse, çakışmayı önlemek için bir sonraki haftaya al

    start.setDate(now.getDate() + daysAhead);
    const [startH, startM] = startTime.split(":").map(Number);
    start.setHours(startH, startM, 0, 0);

    const end = new Date(start);
    const [endH, endM] = endTime.split(":").map(Number);
    end.setHours(endH, endM, 0, 0);

    return { start, end };
  }

  private proximityScore(dayOfWeek: number, startTime: string): number {
    const now = new Date();
    const currentDow = (now.getDay() + 6) % 7;
    const daysAhead = ((dayOfWeek - currentDow + 7) % 7) || 7;
    const [hour] = startTime.split(":").map(Number);

    // Daha yakın gün ve daha erken saat -> daha yüksek puan.
    return 100 - daysAhead * 10 - hour * 0.5;
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const dow = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - dow);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}
