import { apiFetch } from "./client";

export interface SurveySummary {
  id: string; title: string; description: string | null; audience: string; anonymous: boolean;
  active: boolean; startAt: string | null; endAt: string | null; questionCount: number; responseCount: number;
}
export function fetchSurveys() {
  return apiFetch<{ surveys: SurveySummary[] }>("/api/branch/surveys", { cache: "no-store" });
}
export function createSurvey(input: { title: string; description?: string; audience?: string; anonymous?: boolean; questions?: string[] }) {
  return apiFetch<{ survey: { id: string } }>("/api/branch/surveys", { method: "POST", body: JSON.stringify(input) });
}
export const surveyKeys = { branchList: () => ["surveys", "branch-list"] as const };
