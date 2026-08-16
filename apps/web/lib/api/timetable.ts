import { apiFetch } from "./client";

export const DAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export interface TimetableSlotRow {
  id: string;
  classroomId: string;
  classroomName: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function fetchBranchTimetable() {
  return apiFetch<{ slots: TimetableSlotRow[] }>("/api/branch/timetable", { cache: "no-store" });
}

export function createTimetableSlot(input: {
  classroomId: string;
  teacherId: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  return apiFetch<{ slot: { id: string } }>("/api/branch/timetable", { method: "POST", body: JSON.stringify(input) });
}

export function deleteTimetableSlot(slotId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/timetable/${slotId}`, { method: "DELETE" });
}

export interface TeacherTimetableSlotRow {
  id: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomName: string;
}

export function fetchTeacherTimetable() {
  return apiFetch<{ slots: TeacherTimetableSlotRow[] }>("/api/teacher/timetable", { cache: "no-store" });
}

export interface StudentTimetableSlotRow {
  id: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherName: string;
}

export function fetchStudentTimetable(studentId: string) {
  return apiFetch<{ slots: StudentTimetableSlotRow[] }>(`/api/students/${studentId}/timetable`, { cache: "no-store" });
}
