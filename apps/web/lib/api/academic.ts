import { apiFetch } from "./client";

export interface AcademicYearSummary { id: string; label: string; startYear: number; active: boolean; }
export interface PromotionRunSummary { id: string; fromYearLabel: string; toYearLabel: string; promotedCount: number; graduatedCount: number; note: string | null; runAt: string; }

export function fetchAcademicYears() { return apiFetch<{ years: AcademicYearSummary[] }>("/api/branch/academic/years", { cache: "no-store" }); }
export function generateAcademicYears(fromYear?: number) { return apiFetch<{ ok: true; created: number }>("/api/branch/academic/years", { method: "POST", body: JSON.stringify({ action: "generate", fromYear }) }); }
export function activateAcademicYear(yearId: string) { return apiFetch<{ ok: true }>(`/api/branch/academic/years/${yearId}`, { method: "PATCH" }); }
export function fetchPromotionRuns() { return apiFetch<{ runs: PromotionRunSummary[] }>("/api/branch/academic/promotions", { cache: "no-store" }); }
export function runPromotion() { return apiFetch<{ run: PromotionRunSummary }>("/api/branch/academic/promotions", { method: "POST" }); }
export const academicKeys = { years: () => ["academic", "years"] as const, promotions: () => ["academic", "promotions"] as const };
