import { apiFetch } from "./client";

export interface CriticalAchievement {
  achievementId: string;
  code: string;
  label: string;
  subject: string;
  avgRatio: number;
}

export interface StudentRoadmap {
  studentId: string;
  studentName: string;
  gradeLevel: string;
  targetGoal: string | null;
  examCount: number;
  latestNet: number | null;
  maxPossibleNet: number | null;
  netPct: number;
  criticalAchievements: CriticalAchievement[];
}

export function fetchRoadmap(studentId: string) {
  return apiFetch<StudentRoadmap>(`/api/students/${studentId}/roadmap`, { cache: "no-store" });
}

export const roadmapKeys = {
  byStudent: (studentId: string) => ["roadmap", studentId] as const,
};
