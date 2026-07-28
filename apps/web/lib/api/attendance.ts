import { apiFetch } from "./client";

export type AttendanceStatus = "VAR" | "GEC" | "IZINLI" | "YOK";

export interface ClassroomOption {
  id: string;
  name: string;
  gradeLevel: string;
  studentCount: number;
}

export function fetchClassrooms() {
  return apiFetch<{ classrooms: ClassroomOption[] }>("/api/branch/classrooms", { cache: "no-store" });
}

export interface AttendanceRow {
  studentId: string;
  name: string;
  status: AttendanceStatus;
  note: string | null;
}

export function fetchAttendance(classroomId: string, date: string) {
  const qs = new URLSearchParams({ classroomId, date }).toString();
  return apiFetch<{ classroomId: string; date: string; students: AttendanceRow[] }>(
    `/api/branch/attendance?${qs}`,
    { cache: "no-store" },
  );
}

export function saveAttendance(input: {
  classroomId: string;
  date: string;
  records: { studentId: string; status: AttendanceStatus; note?: string }[];
}) {
  return apiFetch<{ ok: true }>("/api/branch/attendance", { method: "POST", body: JSON.stringify(input) });
}

export interface AttendanceHistoryRow {
  date: string;
  status: AttendanceStatus;
  note: string | null;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  excusedDays: number;
  absentDays: number;
  absenceRatePct: number;
}

export function fetchStudentAttendance(studentId: string) {
  return apiFetch<{ studentId: string; records: AttendanceHistoryRow[]; summary: AttendanceSummary }>(
    `/api/students/${studentId}/attendance`,
    { cache: "no-store" },
  );
}

export const attendanceKeys = {
  classrooms: () => ["attendance", "classrooms"] as const,
  byClassroomDate: (classroomId: string, date: string) => ["attendance", "classroom", classroomId, date] as const,
  byStudent: (studentId: string) => ["attendance", "student", studentId] as const,
};
