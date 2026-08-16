import { apiFetch } from "./client";

export interface TeacherPerformanceRow {
  teacherId: string;
  name: string;
  branch: string;
  title: string | null;
  resultCount: number;
  avgMasteryPct: number | null;
}

export function fetchTeacherPerformance() {
  return apiFetch<{ teachers: TeacherPerformanceRow[] }>("/api/branch/teacher-performance", { cache: "no-store" });
}
