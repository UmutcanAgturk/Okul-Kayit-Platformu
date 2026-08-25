import { apiFetch } from "./client";

export interface AnalyticsData {
  totalBranches: number;
  totalStudents: number;
  orgAvgNet: number | null;
  topBranches: { tenantId: string; tenantName: string; city: string | null; avgNet: number | null; studentCount: number }[];
  subjectPerformance: { subject: string; avgMasteryPct: number; count: number }[];
  branchRevenue: { tenantId: string; tenantName: string; city: string | null; totalGelir: number }[];
}

export function fetchAnalytics() {
  return apiFetch<AnalyticsData>("/api/hq/analytics", { cache: "no-store" });
}

export const analyticsKeys = { global: () => ["analytics", "global"] as const };
