import { apiFetch } from "./client";

export interface TeacherPerformanceRow {
  teacherId: string;
  name: string;
  branch: string;
  title: string | null;
  resultCount: number;
  avgMasteryPct: number | null;
  classroomCodes: string[];
  rosterSize: number;
  avgAttendancePct: number | null;
  positiveCount: number;
  negativeCount: number;
}

export interface TeacherPerformanceSummary {
  totalTeachers: number;
  avgAttendancePct: number | null;
  totalRoster: number;
}

export function fetchTeacherPerformance() {
  return apiFetch<{ teachers: TeacherPerformanceRow[]; summary: TeacherPerformanceSummary }>(
    "/api/branch/teacher-performance",
    { cache: "no-store" },
  );
}
