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

export interface ReportCard {
  studentId: string;
  studentName: string;
  examHistory: ExamHistoryRow[];
  subjectBreakdown: SubjectBreakdownRow[];
  attendanceSummary: AttendanceSummary;
}

export function fetchReportCard(studentId: string) {
  return apiFetch<ReportCard>(`/api/students/${studentId}/report-card`, { cache: "no-store" });
}

export const reportCardKeys = {
  byStudent: (studentId: string) => ["report-card", studentId] as const,
};
