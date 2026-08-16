import { apiFetch } from "./client";

export interface ProfileChildRow {
  studentId: string;
  fullName: string;
  studentNo: string;
  gradeLevel: string;
  classroomName: string | null;
  relation: string;
}

export interface ProfileDetail {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  tenantName: string | null;
  branch?: string | null;
  title?: string | null;
  department?: string | null;
  studentNo?: string | null;
  gradeLevel?: string | null;
  classroomName?: string | null;
  targetGoal?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelation?: string | null;
  children?: ProfileChildRow[];
}

export function fetchMyProfile() {
  return apiFetch<ProfileDetail>("/api/me/profile", { cache: "no-store" });
}

export function changeMyPassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: true }>("/api/me/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
