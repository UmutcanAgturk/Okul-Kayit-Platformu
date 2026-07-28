import { apiFetch } from "./client";

export interface HqTenant {
  id: string;
  name: string;
  code: string;
  type: "GENEL_MERKEZ" | "SUBE" | "BOLUM";
  city: string | null;
  district: string | null;
  isActive: boolean;
  studentCount: number;
  classroomCount: number;
  staffCount: number;
  teacherCount: number;
  branchAdminName: string | null;
}

export function fetchHqTenants() {
  return apiFetch<{ tenants: HqTenant[] }>("/api/hq/tenants", { cache: "no-store" });
}

export interface HqLedgerSummaryRow {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  entryCount: number;
  totalGelir: number;
  totalGider: number;
  net: number;
}

export interface HqLedgerSummary {
  tenants: HqLedgerSummaryRow[];
  grandTotal: { totalGelir: number; totalGider: number; net: number };
}

export function fetchHqAccountingSummary() {
  return apiFetch<HqLedgerSummary>("/api/hq/accounting-ledger", { cache: "no-store" });
}

export const hqKeys = {
  tenants: () => ["hq", "tenants"] as const,
  accountingSummary: () => ["hq", "accounting-summary"] as const,
};
