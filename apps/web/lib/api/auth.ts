import { apiFetch } from "./client";

export type UserRole =
  | "SUPERADMIN"
  | "BRANCH_ADMIN"
  | "GUIDANCE_COORDINATOR"
  | "ACCOUNTING"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  teacherId?: string | null;
  students?: { studentId: string; fullName: string }[];
}

export function login(email: string, password: string) {
  return apiFetch<{ user: { id: string; email: string; role: UserRole; firstName: string; lastName: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
}

export function logout() {
  return apiFetch<{ message?: string }>("/api/auth/logout", { method: "POST" });
}

export function fetchMe() {
  return apiFetch<MeResponse>("/api/me", { cache: "no-store" });
}

export const authKeys = {
  me: () => ["auth", "me"] as const,
};
