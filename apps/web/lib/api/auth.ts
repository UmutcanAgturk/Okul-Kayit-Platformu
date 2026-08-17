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
  actingTenantId?: string | null;
  actingTenantName?: string | null;
}

// identifier: personel için e-posta/kullanıcı adı, Öğrenci/Veli için T.C.
// Kimlik No (11 haneli) — bkz. app/api/auth/login/route.ts.
export function login(identifier: string, password: string) {
  return apiFetch<{ user: { id: string; email: string; role: UserRole; firstName: string; lastName: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ identifier, password }) },
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
