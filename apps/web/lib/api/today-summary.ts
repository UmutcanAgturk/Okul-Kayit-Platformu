import { apiFetch } from "./client";

export interface TodayPtaRow {
  id: string;
  studentName: string;
  teacherName: string;
  requestedAt: string;
  status: string;
}

export interface TodayActivityRow {
  id: string;
  actorLabel: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface TodaySummary {
  date: string;
  attendance: { classroomsTotal: number; classroomsTakenToday: number };
  payments: { overdueCount: number; upcomingCount: number };
  pta: { pendingCount: number; today: TodayPtaRow[] };
  recentActivity: TodayActivityRow[];
}

export function fetchTodaySummary() {
  return apiFetch<TodaySummary>("/api/branch/today-summary", { cache: "no-store" });
}

export const todaySummaryKeys = {
  detail: () => ["today-summary"] as const,
};
