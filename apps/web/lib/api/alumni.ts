import { apiFetch } from "./client";

export interface AlumnusSummary {
  id: string; firstName: string; lastName: string; studentNo: string | null;
  graduationYear: string | null; university: string | null; employment: string | null;
  phone: string | null; email: string | null; note: string | null;
}
export function fetchAlumni() {
  return apiFetch<{ alumni: AlumnusSummary[] }>("/api/branch/alumni", { cache: "no-store" });
}
export function createAlumnus(input: { firstName: string; lastName: string; studentNo?: string; graduationYear?: string; university?: string; employment?: string; phone?: string; email?: string; note?: string }) {
  return apiFetch<{ alumnus: { id: string } }>("/api/branch/alumni", { method: "POST", body: JSON.stringify(input) });
}
export const alumniKeys = { branchList: () => ["alumni", "branch-list"] as const };
