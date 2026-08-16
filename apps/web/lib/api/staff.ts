import { apiFetch } from "./client";

export type StaffUserRole = "BRANCH_ADMIN" | "ACCOUNTING" | "GUIDANCE_COORDINATOR";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffUserRole;
  isActive: boolean;
  title: string;
  department: string | null;
  startDate: string;
  salary: string;
}

export function fetchStaff() {
  return apiFetch<{ staff: StaffMember[] }>("/api/branch/staff", { cache: "no-store" });
}

export function createStaff(input: {
  fullName: string;
  role: StaffUserRole;
  title: string;
  department?: string;
  startDate: string;
  salary: number;
  phone?: string;
}) {
  return apiFetch<{ staff: StaffMember; credentials: { username: string; password: string } }>(
    "/api/branch/staff",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function deactivateStaff(staffId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/staff/${staffId}`, { method: "DELETE" });
}

export function updateStaffRole(staffId: string, role: StaffUserRole) {
  return apiFetch<{ staff: StaffMember }>(`/api/branch/staff/${staffId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function updateStaffUsername(staffId: string, username: string) {
  return apiFetch<{ staff: StaffMember }>(`/api/branch/staff/${staffId}`, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

export function updateStaffProfile(
  staffId: string,
  input: Partial<{ title: string; department: string; startDate: string; salary: number; phone: string; isActive: boolean }>,
) {
  return apiFetch<{ staff: StaffMember }>(`/api/branch/staff/${staffId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export const staffKeys = {
  list: () => ["staff", "list"] as const,
};
