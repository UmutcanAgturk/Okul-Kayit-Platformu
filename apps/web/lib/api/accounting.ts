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

export function fetchLedger() {
  return apiFetch<LedgerResponse>("/api/branch/accounting-ledger", { cache: "no-store" });
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

export interface Installment {
  id: string;
  studentId: string;
  studentName: string;
  installmentNo: number;
  amount: string;
  dueDate: string;
  paidAt: string | null;
  status: "PENDING" | "PAID";
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

export interface PayrollRecord {
  id: string;
  period: string;
  teacherId: string;
  teacherName: string;
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

export function createPayroll(input: { teacherId: string; period: string; grossSalary: number }) {
  return apiFetch<{ record: PayrollRecord }>("/api/branch/payroll", { method: "POST", body: JSON.stringify(input) });
}

export const accountingKeys = {
  ledger: () => ["accounting", "ledger"] as const,
  vatSummary: () => ["accounting", "vat-summary"] as const,
  installments: (status?: string) => ["accounting", "installments", status ?? "ALL"] as const,
  aging: () => ["accounting", "aging"] as const,
  payroll: () => ["accounting", "payroll"] as const,
};
