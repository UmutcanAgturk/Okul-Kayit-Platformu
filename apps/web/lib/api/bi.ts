import { apiFetch } from "./client";

export interface BiDashboard {
  students: { total: number; unassigned: number };
  occupancy: { capacity: number; enrolled: number; pct: number };
  collection: { collectedAmount: number; outstandingAmount: number; overdueAmount: number; rate: number };
  finance: { revenueThisMonth: number; expenseThisMonth: number; netThisMonth: number; trend: { label: string; revenue: number; expense: number; net: number }[] };
  academic: { avgNet: number | null; examResultCount: number; subjectPerformance: { subject: string; pct: number }[] };
  staff: { teacherCount: number; staffCount: number };
}

export function fetchBiDashboard() {
  return apiFetch<BiDashboard>("/api/branch/bi/dashboard", { cache: "no-store" });
}

export const biKeys = { dashboard: () => ["bi", "dashboard"] as const };
