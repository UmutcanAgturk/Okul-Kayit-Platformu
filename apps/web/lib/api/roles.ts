import { apiFetch } from "./client";

export interface RoleStudentRow {
  id: string;
  name: string;
  studentNo: string;
  classroomName: string | null;
  username: string;
}

export function fetchRoleStudents() {
  return apiFetch<{ students: RoleStudentRow[] }>("/api/branch/roles/students", { cache: "no-store" });
}

export function updateStudentUsername(studentId: string, username: string) {
  return apiFetch<{ username: string }>(`/api/branch/roles/students/${studentId}`, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

export interface RoleGuardianRow {
  parentId: string;
  guardianName: string;
  studentName: string;
  relation: string;
  username: string;
}

export function fetchRoleGuardians() {
  return apiFetch<{ guardians: RoleGuardianRow[] }>("/api/branch/roles/guardians", { cache: "no-store" });
}

export function updateGuardianUsername(parentId: string, username: string) {
  return apiFetch<{ username: string }>(`/api/branch/roles/guardians/${parentId}`, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

export const roleKeys = {
  students: () => ["roles", "students"] as const,
  guardians: () => ["roles", "guardians"] as const,
};
