import { apiFetch } from "./client";

export interface AchievementOption {
  id: string;
  code: string;
  label: string;
  subject: string;
}

export function fetchAchievements() {
  return apiFetch<{ achievements: AchievementOption[] }>("/api/curriculum/achievements", { cache: "no-store" });
}

export interface QuizAttempt {
  id: string;
  subject: string;
  achievementCode: string | null;
  achievementLabel: string | null;
  correctCount: number;
  totalCount: number;
  createdAt: string;
}

export function fetchQuizAttempts(studentId: string) {
  return apiFetch<{ attempts: QuizAttempt[] }>(`/api/students/${studentId}/quiz-attempts`, { cache: "no-store" });
}

export function createQuizAttempt(
  studentId: string,
  input: { subject: string; achievementId?: string; correctCount: number; totalCount: number },
) {
  return apiFetch<{ attempt: { id: string } }>(`/api/students/${studentId}/quiz-attempts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const quizKeys = {
  achievements: () => ["quiz", "achievements"] as const,
  byStudent: (studentId: string) => ["quiz", "attempts", studentId] as const,
};
