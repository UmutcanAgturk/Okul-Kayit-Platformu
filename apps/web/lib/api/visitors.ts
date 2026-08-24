import { apiFetch } from "./client";

export interface VisitorSummary {
  id: string; visitorName: string; reason: string | null; hostName: string | null;
  phone: string | null; checkInAt: string; checkOutAt: string | null;
}
export function fetchVisitors() {
  return apiFetch<{ visitors: VisitorSummary[] }>("/api/branch/visitors", { cache: "no-store" });
}
export function createVisitor(input: { visitorName: string; reason?: string; hostName?: string; phone?: string }) {
  return apiFetch<{ visitor: { id: string } }>("/api/branch/visitors", { method: "POST", body: JSON.stringify(input) });
}
export function checkoutVisitor(id: string) {
  return apiFetch<{ ok: true }>(`/api/branch/visitors/${id}`, { method: "PATCH" });
}
export const visitorKeys = { branchList: () => ["visitors", "branch-list"] as const };
