import { apiFetch } from "./client";

export interface Badge {
  id: string;
  label: string;
  desc: string;
  earned: boolean;
}

export interface StudentGamification {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  classRank: number | null;
  classSize: number;
  stats: {
    examCount: number;
    attRate: number | null;
    etutJoined: number;
    bestNet: number;
    disciplinePoints: number;
    clubCount: number;
    quizAttemptCount: number;
  };
  badges: Badge[];
}

export function fetchStudentGamification(studentId: string) {
  return apiFetch<StudentGamification>(`/api/students/${studentId}/gamification`, { cache: "no-store" });
}

export interface LeaderboardRow {
  studentId: string;
  name: string;
  classroom: string | null;
  xp: number;
  level: number;
  badgeCount: number;
}

export function fetchLeaderboard() {
  return apiFetch<{ rows: LeaderboardRow[] }>("/api/branch/leaderboard", { cache: "no-store" });
}

export const gamificationKeys = {
  student: (studentId: string) => ["gamification", "student", studentId] as const,
  leaderboard: () => ["gamification", "leaderboard"] as const,
};
