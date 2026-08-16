import { apiFetch } from "./client";

export interface BranchStudentRow {
  id: string;
  studentNo: string;
  name: string;
  gradeLevel: string;
  classroomId: string | null;
  classroomName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface BranchClassroom {
  id: string;
  name: string;
  gradeLevel: string;
  studentCount: number;
}

export const studentsRosterKeys = {
  all: () => ["branch-students"] as const,
};

export function fetchBranchStudents() {
  return apiFetch<{ students: BranchStudentRow[] }>("/api/branch/students", { cache: "no-store" });
}

export function fetchBranchClassrooms() {
  return apiFetch<{ classrooms: BranchClassroom[] }>("/api/branch/classrooms", { cache: "no-store" });
}

export function assignStudentClassroom(studentId: string, classroomId: string | null) {
  return apiFetch<{ studentId: string; classroomId: string | null; classroomName: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify({ classroomId }) },
  );
}
