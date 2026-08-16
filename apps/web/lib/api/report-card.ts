import { apiFetch } from "./client";

export interface ExamHistoryRow {
  examId: string;
  examName: string;
  examType: string;
  examDate: string;
  netScore: number;
  rawScore: number;
  percentile: number | null;
}

export interface SubjectBreakdownRow {
  subject: string;
  achievementCount: number;
  avgMasteryPct: number;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  excusedDays: number;
  absentDays: number;
  absenceRatePct: number;
}

export interface DisciplineSummary {
  recordCount: number;
  positiveCount: number;
  negativeCount: number;
  netPoints: number;
}

export interface ReportCardSummary {
  overallAvgMasteryPct: number | null;
  strongestSubject: string | null;
  weakestSubject: string | null;
}

export interface ReportCard {
  studentId: string;
  studentName: string;
  examHistory: ExamHistoryRow[];
  subjectBreakdown: SubjectBreakdownRow[];
  attendanceSummary: AttendanceSummary;
  disciplineSummary: DisciplineSummary;
  summary: ReportCardSummary;
}

export function fetchReportCard(studentId: string) {
  return apiFetch<ReportCard>(`/api/students/${studentId}/report-card`, { cache: "no-store" });
}

/**
 * "Öğretmen/AI Değerlendirmesi" — demo/seviye360-app.html'deki
 * buildKarneHtml()'deki gibi (satır ~6269-6277) saklanan bir yorum değil,
 * en güçlü/zayıf ders ve devam oranından şablonla üretilen bir metin.
 * Hem ekran görünümü (ReportCardView) hem yazdırılabilir belge
 * (KarnePrintBody) tarafından paylaşılır.
 */
export function buildReportCardNarrative(report: ReportCard): string {
  const { strongestSubject, weakestSubject } = report.summary;
  const presenceRatePct = 100 - report.attendanceSummary.absenceRatePct;
  const parts: string[] = [];
  if (strongestSubject) parts.push(`${report.studentName}, ${strongestSubject} dersinde güçlü bir performans sergiliyor.`);
  if (weakestSubject && weakestSubject !== strongestSubject) parts.push(`${weakestSubject} dersinde ek çalışmayla gelişim sağlanabilir.`);
  if (report.attendanceSummary.totalDays > 0) {
    parts.push(
      presenceRatePct >= 90
        ? "Devam durumu düzenli."
        : presenceRatePct >= 75
          ? "Devam durumu takip edilmeli."
          : "Devamsızlık oranı dikkat gerektiriyor.",
    );
  }
  return parts.length > 0 ? parts.join(" ") : "Değerlendirme için yeterli veri henüz oluşmadı.";
}

export const reportCardKeys = {
  byStudent: (studentId: string) => ["report-card", studentId] as const,
};
