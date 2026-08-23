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
  twoFactorEnabled?: boolean;
}

// identifier: personel için e-posta/kullanıcı adı, Öğrenci/Veli için T.C.
// Kimlik No (11 haneli) — bkz. app/api/auth/login/route.ts.
export type LoginResult =
  | { user: { id: string; email: string; role: UserRole; firstName: string; lastName: string }; mfaRequired?: false }
  | { mfaRequired: true; mfaToken: string };

export function login(identifier: string, password: string) {
  return apiFetch<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

/** İki faktörlü girişin ikinci adımı — TOTP kodunu doğrular, oturumu açar. */
export function verifyLogin2fa(mfaToken: string, code: string) {
  return apiFetch<{ user: { id: string; email: string; role: UserRole; firstName: string; lastName: string } }>(
    "/api/auth/login/verify",
    { method: "POST", body: JSON.stringify({ mfaToken, code }) },
  );
}

// ---- 2FA yönetimi (oturum açmış kullanıcı, tüm roller) ----
export function fetch2faStatus() {
  return apiFetch<{ twoFactorEnabled: boolean }>("/api/me/2fa", { cache: "no-store" });
}
export function setup2fa() {
  return apiFetch<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/api/me/2fa/setup", { method: "POST" });
}
export function enable2fa(code: string) {
  return apiFetch<{ ok: true; twoFactorEnabled: true }>("/api/me/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
export function disable2fa(params: { code?: string; password?: string }) {
  return apiFetch<{ ok: true; twoFactorEnabled: false }>("/api/me/2fa", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
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
