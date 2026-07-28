import { AttendanceStatus, DisciplineRecord, StudySessionStatus } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Gamification (XP/Seviye/Rozet/Lider Tablosu) — demo'daki
 * `studentGamificationStats()`'in gerçek karşılığı. XP rastgele bir sayı
 * DEĞİLDİR: bu depodaki gerçek ExamResult/AttendanceRecord/StudySession/
 * DisciplineRecord/ClubMembership/QuizAttempt verisinden hesaplanan bir
 * formüldür (bkz. demo'daki aynı isimli fonksiyonun yorumu) — yeni bir
 * Prisma modeli EKLEMEZ, saf agregasyondur (Bugün Özeti/Raporlar ile aynı
 * prensip).
 */
export interface GamificationContext {
  examCount: number;
  attRate: number | null;
  etutJoined: number;
  hasStrongMastery: boolean;
  bestNet: number;
  disciplinePoints: number;
  clubCount: number;
  quizAttemptCount: number;
  xp: number;
}

export async function computeStudentGamificationContext(
  tx: Prisma.TransactionClient | PrismaClient,
  studentId: string,
): Promise<GamificationContext> {
  const [examResults, achievementResults, attendanceRecords, etutJoined, disciplineRecords, clubCount, quizAttempts] = await Promise.all([
    tx.examResult.findMany({ where: { studentId }, select: { netScore: true } }),
    tx.studentAchievementResult.findMany({ where: { studentId }, select: { correctRatio: true } }),
    tx.attendanceRecord.findMany({ where: { studentId }, select: { status: true } }),
    tx.studySession.count({ where: { studentId, status: { in: [StudySessionStatus.TEACHER_APPROVED, StudySessionStatus.COMPLETED] } } }),
    tx.disciplineRecord.findMany({ where: { studentId }, select: { points: true } }),
    tx.clubMembership.count({ where: { studentId } }),
    tx.quizAttempt.findMany({ where: { studentId }, select: { correctCount: true } }),
  ]);

  const examCount = examResults.length;
  const bestNet = examResults.reduce((max, r) => Math.max(max, r.netScore), 0);
  const hasStrongMastery = achievementResults.some((r) => r.correctRatio >= 0.7);

  const present = attendanceRecords.filter((r) => r.status === AttendanceStatus.VAR || r.status === AttendanceStatus.GEC).length;
  const attRate = attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 100) : null;

  const disciplinePoints = disciplineRecords.reduce((sum: number, r: Pick<DisciplineRecord, "points">) => sum + r.points, 0);
  const quizCorrectTotal = quizAttempts.reduce((sum, q) => sum + q.correctCount, 0);

  let xp = 0;
  for (const r of examResults) xp += 40 + Math.round(Math.max(0, r.netScore) * 4);
  for (const r of attendanceRecords) xp += r.status === AttendanceStatus.VAR ? 3 : r.status === AttendanceStatus.GEC ? 1 : 0;
  xp += etutJoined * 15;
  xp += disciplinePoints;
  xp += clubCount * 20;
  xp += quizCorrectTotal * 5;
  xp = Math.max(0, xp);

  return { examCount, attRate, etutJoined, hasStrongMastery, bestNet, disciplinePoints, clubCount, quizAttemptCount: quizAttempts.length, xp };
}

export function xpLevelInfo(xp: number) {
  let level = 1;
  let threshold = 150;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level++;
    threshold = Math.round(threshold * 1.18);
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: threshold, progressPct: Math.min(100, Math.round((remaining / threshold) * 100)) };
}

export const BADGE_DEFS: { id: string; label: string; desc: string; test: (ctx: GamificationContext) => boolean }[] = [
  { id: "ilk-adim", label: "İlk Adım", desc: "İlk sınavına katıldı", test: (ctx) => ctx.examCount >= 1 },
  { id: "azimli", label: "Azimli Öğrenci", desc: "5 veya daha fazla sınava katıldı", test: (ctx) => ctx.examCount >= 5 },
  { id: "devamli", label: "Sürekli Katılımcı", desc: "Devam oranı %90 ve üzeri", test: (ctx) => ctx.attRate != null && ctx.attRate >= 90 },
  { id: "usta", label: "Kazanım Ustası", desc: "En az bir kazanımda güçlü seviyeye ulaştı", test: (ctx) => ctx.hasStrongMastery },
  { id: "net-sampiyonu", label: "Net Şampiyonu", desc: "Bir sınavda 15 veya üzeri net yaptı", test: (ctx) => ctx.bestNet >= 15 },
  { id: "etut-gonullusu", label: "Etüt Gönüllüsü", desc: "Onaylı bir etüde katıldı", test: (ctx) => ctx.etutJoined >= 1 },
  { id: "sosyal-kelebek", label: "Sosyal Kelebek", desc: "Bir veya daha fazla kulübe üye", test: (ctx) => ctx.clubCount >= 1 },
  { id: "pratik-ustasi", label: "Pratik Ustası", desc: "3 veya daha fazla pratik quiz tamamladı", test: (ctx) => ctx.quizAttemptCount >= 3 },
];

export function earnedBadges(ctx: GamificationContext) {
  return BADGE_DEFS.filter((b) => b.test(ctx));
}
