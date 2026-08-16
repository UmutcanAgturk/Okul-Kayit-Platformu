import { apiFetch } from "./client";

export interface BranchExam {
  id: string;
  name: string;
  type: string;
  examDate: string;
  questionCount: number;
  resultCount: number;
  avgNet: number | null;
}

export function fetchBranchExams() {
  return apiFetch<{ exams: BranchExam[] }>("/api/branch/exams", { cache: "no-store" });
}

export function createBranchExam(input: { name: string; examDate: string; type?: string; questions: { achievementId: string }[] }) {
  return apiFetch<{ exam: BranchExam }>("/api/branch/exams", { method: "POST", body: JSON.stringify(input) });
}

export interface ExamQuestionDetail {
  id: string;
  orderIndex: number;
  achievementId: string;
  achievementCode: string;
  achievementLabel: string;
  subject: string;
}

export function fetchBranchExamDetail(examId: string) {
  return apiFetch<{ exam: { id: string; name: string; type: string; examDate: string; questions: ExamQuestionDetail[] } }>(
    `/api/branch/exams/${examId}`,
    { cache: "no-store" },
  );
}

export interface ExamResultRosterRow {
  studentId: string;
  studentNo: string;
  name: string;
  hasResult: boolean;
  netScore: number | null;
}

export function fetchExamResultRoster(examId: string, classroomId: string) {
  return apiFetch<{ roster: ExamResultRosterRow[] }>(
    `/api/branch/exams/${examId}/results?classroomId=${encodeURIComponent(classroomId)}`,
    { cache: "no-store" },
  );
}

export function submitExamResult(examId: string, input: { studentId: string; answers: { questionId: string; isCorrect: boolean | null }[] }) {
  return apiFetch<{ correctCount: number; wrongCount: number; emptyCount: number; netScore: number }>(
    `/api/branch/exams/${examId}/results`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export interface AchievementSummaryRow {
  achievementId: string;
  code: string;
  label: string;
  subject: string;
  avgMasteryPct: number;
  count: number;
}

export function fetchAchievementSummary() {
  return apiFetch<{ achievements: AchievementSummaryRow[] }>("/api/branch/exams/achievement-summary", { cache: "no-store" });
}

export interface CurriculumAchievement {
  id: string;
  code: string;
  label: string;
  gradeLevel: number;
  subject: string;
}

export function fetchCurriculumAchievements() {
  return apiFetch<{ achievements: CurriculumAchievement[] }>("/api/curriculum/achievements", { cache: "no-store" });
}

export function createCurriculumAchievement(input: { code: string; label: string; gradeLevel: number }) {
  return apiFetch<{ achievement: CurriculumAchievement }>("/api/curriculum/achievements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteCurriculumAchievement(achievementId: string) {
  return apiFetch<{ ok: true }>(`/api/curriculum/achievements/${achievementId}`, { method: "DELETE" });
}

export function updateCurriculumAchievementGrade(achievementId: string, gradeLevel: number) {
  return apiFetch<{ achievement: CurriculumAchievement }>(`/api/curriculum/achievements/${achievementId}`, {
    method: "PATCH",
    body: JSON.stringify({ gradeLevel }),
  });
}

export interface BulkAchievementRowResult {
  row: number;
  ok: boolean;
  message?: string;
  achievement?: CurriculumAchievement;
}

export function bulkImportCurriculumAchievements(rows: { code: string; label: string; gradeLevel: number }[]) {
  return apiFetch<{ results: BulkAchievementRowResult[]; successCount: number; errorCount: number }>(
    "/api/curriculum/achievements/bulk",
    { method: "POST", body: JSON.stringify({ rows }) },
  );
}

export const examKeys = {
  list: () => ["branch-exams", "list"] as const,
  detail: (examId: string) => ["branch-exams", "detail", examId] as const,
  roster: (examId: string, classroomId: string) => ["branch-exams", "roster", examId, classroomId] as const,
  achievementSummary: () => ["branch-exams", "achievement-summary"] as const,
  curriculum: () => ["curriculum", "achievements"] as const,
};
