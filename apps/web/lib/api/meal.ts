import { apiFetch } from "./client";

export interface MealItemSummary {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  active: boolean;
}

export interface MenuPlanSummary {
  id: string;
  date: string;
  mealType: string | null;
  gradeLevels: string[];
  items: string[];
  expectedParticipation: number | null;
  note: string | null;
  published: boolean;
}

export function fetchMealItems() {
  return apiFetch<{ items: MealItemSummary[] }>("/api/branch/meal/items", { cache: "no-store" });
}

export function createMealItem(input: { name: string; category?: string; barcode?: string; active?: boolean }) {
  return apiFetch<{ item: { id: string } }>("/api/branch/meal/items", { method: "POST", body: JSON.stringify(input) });
}

export function fetchMenuPlans() {
  return apiFetch<{ plans: MenuPlanSummary[] }>("/api/branch/meal/plans", { cache: "no-store" });
}

export function createMenuPlan(input: {
  date: string;
  mealType?: string;
  gradeLevels?: string[];
  items?: string[];
  expectedParticipation?: number;
  note?: string;
  published?: boolean;
}) {
  return apiFetch<{ plan: { id: string } }>("/api/branch/meal/plans", { method: "POST", body: JSON.stringify(input) });
}

export const mealKeys = {
  items: () => ["meal", "items"] as const,
  plans: () => ["meal", "plans"] as const,
};
