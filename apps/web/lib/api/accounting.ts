import { apiFetch } from "./client";

export interface LedgerEntry {
  id: string;
  type: "GELIR" | "GIDER";
  category: string;
  amount: string;
  entryDate: string;
  note: string | null;
  vatRate: string | null;
  withholdingRate: string | null;
  tax: { base: number; vatAmount: number; withholdingAmount: number; netPayable: number };
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  summary: { totalGelir: number; totalGider: number; net: number };
}

export function fetchLedger(filter?: { type?: "GELIR" | "GIDER"; search?: string }) {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.search) params.set("search", filter.search);
  const qs = params.toString();
  return apiFetch<LedgerResponse>(`/api/branch/accounting-ledger${qs ? `?${qs}` : ""}`, { cache: "no-store" });
}

export function createLedgerEntry(input: {
  type: "GELIR" | "GIDER";
  category: string;
  amount: number;
  entryDate: string;
  note?: string;
  vatRate?: number | null;
  withholdingRate?: number | null;
}) {
  return apiFetch<{ entry: LedgerEntry }>("/api/branch/accounting-ledger", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLedgerEntry(
  entryId: string,
  input: {
    type: "GELIR" | "GIDER";
    category: string;
    amount: number;
    entryDate: string;
    note?: string;
    vatRate?: number | null;
    withholdingRate?: number | null;
  },
) {
  return apiFetch<{ entry: LedgerEntry }>(`/api/branch/accounting-ledger/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteLedgerEntry(entryId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/accounting-ledger/${entryId}`, { method: "DELETE" });
}

export interface VatSummaryRow {
  id: string;
  type: "GELIR" | "GIDER";
  category: string;
  entryDate: string;
  vatRate: number;
  base: number;
  vatAmount: number;
}

export interface VatSummaryResponse {
  rows: VatSummaryRow[];
  summary: { hesaplananKdv: number; indirilecekKdv: number; odenecekKdv: number; devredenKdv: number };
}

export function fetchVatSummary() {
  return apiFetch<VatSummaryResponse>("/api/branch/accounting-ledger/vat-summary", { cache: "no-store" });
}

export interface WithholdingSummary {
  kayitSayisi: number;
  brutToplam: number;
  stopajKesintisi: number;
  netOdenecek: number;
}

export function fetchWithholdingSummary() {
  return apiFetch<{ summary: WithholdingSummary }>("/api/branch/accounting-ledger/withholding-summary", { cache: "no-store" });
}

export interface TaxSettings {
  taxNo: string | null;
  taxOffice: string | null;
}

export function fetchTaxSettings() {
  return apiFetch<{ settings: TaxSettings }>("/api/branch/tax-settings", { cache: "no-store" });
}

export function updateTaxSettings(input: { taxNo?: string | null; taxOffice?: string | null }) {
  return apiFetch<{ settings: TaxSettings }>("/api/branch/tax-settings", { method: "PATCH", body: JSON.stringify(input) });
}

export interface Installment {
  id: string;
  studentId: string;
  studentName: string;
  installmentNo: number;
  amount: string;
  dueDate: string;
  paidAt: string | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
}

export function fetchInstallments(status?: "PENDING" | "PAID") {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<{ installments: Installment[] }>(`/api/branch/payment-installments${qs}`, { cache: "no-store" });
}

export function collectInstallment(installmentId: string) {
  return apiFetch<{ installment: Installment; ledgerEntry: LedgerEntry }>(
    `/api/branch/payment-installments/${installmentId}/collect`,
    { method: "POST" },
  );
}

export interface AgingBucket { id: string; label: string; count: number; amount: number }
export interface AgingRow { studentId: string; studentName: string; count: number; totalAmount: number; oldestDueDate: string; daysLate: number; bucketId: string }

export function fetchAging() {
  return apiFetch<{ buckets: AgingBucket[]; rows: AgingRow[] }>("/api/branch/payment-installments/aging", { cache: "no-store" });
}

export interface BranchCollectionRateRow {
  tenantId: string;
  tenantName: string;
  city: string;
  collectionRate: number | null;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

export function fetchBranchCollectionRates() {
  return apiFetch<{ branches: BranchCollectionRateRow[] }>("/api/hq/payment-installments/collection-rate", { cache: "no-store" });
}

export interface PayrollRecord {
  id: string;
  period: string;
  teacherId: string | null;
  staffProfileId: string | null;
  personName: string;
  personRole: "TEACHER" | "STAFF";
  grossSalary: string;
  sgkEmployeeShare: string;
  unemploymentEmployeeShare: string;
  incomeTaxWithheld: string;
  stampDutyWithheld: string;
  netSalary: string;
  sgkEmployerShare: string;
  unemploymentEmployerShare: string;
  employerCost: string;
  createdAt: string;
}

export function fetchPayroll() {
  return apiFetch<{ records: PayrollRecord[] }>("/api/branch/payroll", { cache: "no-store" });
}

export function createPayroll(input: { teacherId?: string; staffProfileId?: string; period: string; grossSalary: number }) {
  return apiFetch<{ record: PayrollRecord }>("/api/branch/payroll", { method: "POST", body: JSON.stringify(input) });
}

export const accountingKeys = {
  ledger: (filter?: { type?: string; search?: string }) =>
    ["accounting", "ledger", filter?.type ?? "ALL", filter?.search ?? ""] as const,
  vatSummary: () => ["accounting", "vat-summary"] as const,
  withholdingSummary: () => ["accounting", "withholding-summary"] as const,
  taxSettings: () => ["accounting", "tax-settings"] as const,
  installments: (status?: string) => ["accounting", "installments", status ?? "ALL"] as const,
  aging: () => ["accounting", "aging"] as const,
  payroll: () => ["accounting", "payroll"] as const,
};
