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
  capacity: number;
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

export function createClassroom(input: { gradeLevel: string; suffix: string; capacity: number }) {
  return apiFetch<{ classroom: BranchClassroom }>("/api/branch/classrooms", { method: "POST", body: JSON.stringify(input) });
}

export function updateClassroom(classroomId: string, input: Partial<{ suffix: string; capacity: number }>) {
  return apiFetch<{ classroom: BranchClassroom }>(`/api/branch/classrooms/${classroomId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteClassroom(classroomId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/classrooms/${classroomId}`, { method: "DELETE" });
}

export interface ClassroomDetail {
  classroom: { id: string; name: string; gradeLevel: string; capacity: number };
  students: { id: string; studentNo: string; name: string; guardianName: string | null; guardianPhone: string | null }[];
  subjectTeachers: { subject: string; teacherName: string }[];
  weeklyPlan: { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string; teacherName: string }[];
}

export function fetchClassroomDetail(classroomId: string) {
  return apiFetch<ClassroomDetail>(`/api/branch/classrooms/${classroomId}/detail`, { cache: "no-store" });
}

export function assignStudentClassroom(studentId: string, classroomId: string | null) {
  return apiFetch<{ studentId: string; classroomId: string | null; classroomName: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify({ classroomId }) },
  );
}

export function updateStudentGuardianContact(studentId: string, input: { guardianFullName: string; guardianPhone: string }) {
  return apiFetch<{ studentId: string; guardianName: string | null; guardianPhone: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteStudentPermanently(studentId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/students/${studentId}?permanent=true`, { method: "DELETE" });
}
