import { apiFetch } from "./client";

export interface CounselingCaseSummary {
  id: string; subjectName: string | null; studentId: string | null; reason: string; counselors: string[];
  description: string | null; status: string; openedAt: string; closedAt: string | null; closureReason: string | null;
}
export function fetchCounselingCases() { return apiFetch<{ cases: CounselingCaseSummary[] }>("/api/branch/counseling", { cache: "no-store" }); }
export function createCounselingCase(input: { reason: string; subjectName?: string; studentId?: string; counselors?: string[]; description?: string }) {
  return apiFetch<{ case: { id: string } }>("/api/branch/counseling", { method: "POST", body: JSON.stringify(input) });
}
export function closeCounselingCase(caseId: string, closureReason?: string) {
  return apiFetch<{ ok: true }>(`/api/branch/counseling/${caseId}`, { method: "PATCH", body: JSON.stringify({ closureReason }) });
}
export const counselingKeys = { branchList: () => ["counseling", "branch-list"] as const };
