import { apiFetch } from "./client";

export interface MedicalCaseSummary {
  id: string; patientName: string | null; studentId: string | null; severity: string; status: string;
  description: string | null; notes: string | null; openedAt: string; closedAt: string | null;
}
export interface HealthScreeningSummary {
  id: string; name: string; source: string | null; targetGrades: string[]; scheduledDate: string | null; note: string | null;
}
export function fetchMedicalCases() { return apiFetch<{ cases: MedicalCaseSummary[] }>("/api/branch/health/cases", { cache: "no-store" }); }
export function createMedicalCase(input: { patientName: string; studentId?: string; severity?: string; description?: string; notes?: string }) {
  return apiFetch<{ case: { id: string } }>("/api/branch/health/cases", { method: "POST", body: JSON.stringify(input) });
}
export function closeMedicalCase(caseId: string) { return apiFetch<{ ok: true }>(`/api/branch/health/cases/${caseId}`, { method: "PATCH" }); }
export function fetchScreenings() { return apiFetch<{ screenings: HealthScreeningSummary[] }>("/api/branch/health/screenings", { cache: "no-store" }); }
export function createScreening(input: { name: string; source?: string; targetGrades?: string[]; scheduledDate?: string; note?: string }) {
  return apiFetch<{ screening: { id: string } }>("/api/branch/health/screenings", { method: "POST", body: JSON.stringify(input) });
}
export const healthKeys = { cases: () => ["health", "cases"] as const, screenings: () => ["health", "screenings"] as const };
