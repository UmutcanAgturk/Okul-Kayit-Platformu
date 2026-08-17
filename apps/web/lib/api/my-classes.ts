import { apiFetch } from "./client";

export interface MyClassStudentRow {
  studentId: string;
  studentNo: string;
  name: string;
  gradeLevel: string;
  netAvg: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface MyClassRow {
  classroomId: string;
  classroomName: string;
  students: MyClassStudentRow[];
}

export function fetchMyClasses(asTeacherId?: string | null) {
  const qs = asTeacherId ? `?asTeacherId=${asTeacherId}` : "";
  return apiFetch<{ classrooms: MyClassRow[] }>(`/api/teacher/my-classes${qs}`, { cache: "no-store" });
}
