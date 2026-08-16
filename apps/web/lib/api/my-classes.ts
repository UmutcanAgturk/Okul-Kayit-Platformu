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

export function fetchMyClasses() {
  return apiFetch<{ classrooms: MyClassRow[] }>("/api/teacher/my-classes", { cache: "no-store" });
}
