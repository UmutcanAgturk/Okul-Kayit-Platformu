import { apiFetch } from "./client";

export interface BranchMapRow {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  capacity: number | null;
  studentCount: number;
  occupancyPct: number;
  collectionPct: number;
  revenue: number;
}

export function fetchBranchMap() {
  return apiFetch<{ branches: BranchMapRow[] }>("/api/hq/branch-map", { cache: "no-store" });
}

export function toneForPct(pct: number): "strong" | "weak" | "critical" {
  if (pct >= 85) return "strong";
  if (pct >= 70) return "weak";
  return "critical";
}
