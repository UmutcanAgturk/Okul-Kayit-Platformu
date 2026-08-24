import { apiFetch } from "./client";

export interface SchoolEventSummary {
  id: string; title: string; description: string | null; eventType: string | null; location: string | null;
  startAt: string; endAt: string | null; participantCount: number;
}
export function fetchEvents() {
  return apiFetch<{ events: SchoolEventSummary[] }>("/api/branch/events", { cache: "no-store" });
}
export function createEvent(input: { title: string; description?: string; eventType?: string; location?: string; startAt: string; endAt?: string }) {
  return apiFetch<{ event: { id: string } }>("/api/branch/events", { method: "POST", body: JSON.stringify(input) });
}
export const eventKeys = { branchList: () => ["events", "branch-list"] as const };
