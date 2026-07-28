import { apiFetch } from "./client";

export interface ActivityLogEntry {
  id: string;
  actorLabel: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export function fetchActivityLog() {
  return apiFetch<{ entries: ActivityLogEntry[] }>("/api/branch/activity-log", { cache: "no-store" });
}

export const activityLogKeys = {
  list: () => ["activity-log", "list"] as const,
};
