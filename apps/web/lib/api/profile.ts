import { apiFetch } from "./client";

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
