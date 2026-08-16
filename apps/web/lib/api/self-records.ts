import { apiFetch } from "./client";

export interface AttendanceRecordRow {
  date: string;
  status: "VAR" | "GEC" | "IZINLI" | "YOK";
  note: string | null;
}

export interface StudentAttendance {
  studentId: string;
  records: AttendanceRecordRow[];
  summary: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    excusedDays: number;
    absentDays: number;
    absenceRatePct: number;
  };
}

export function fetchStudentAttendance(studentId: string) {
  return apiFetch<StudentAttendance>(`/api/students/${studentId}/attendance`, { cache: "no-store" });
}

export interface DisciplineRecordRow {
  id: string;
  type: "OLUMLU" | "OLUMSUZ";
  category: string;
  note: string | null;
  points: number;
  createdAt: string;
}

export interface StudentDiscipline {
  studentId: string;
  records: DisciplineRecordRow[];
  netPoints: number;
}

export function fetchStudentDiscipline(studentId: string) {
  return apiFetch<StudentDiscipline>(`/api/students/${studentId}/discipline`, { cache: "no-store" });
}
