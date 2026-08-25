import { apiFetch } from "./client";

export type AccountType = "VARLIK" | "YABANCI_KAYNAK" | "OZKAYNAK" | "GELIR" | "GIDER" | "MALIYET";
export type NormalBalance = "BORC" | "ALACAK";

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode: string | null;
  isActive: boolean;
  studentId: string | null;
  supplierId: string | null;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string | null;
}
export interface JournalEntry {
  id: string;
  no: string;
  entryDate: string;
  description: string;
  source: string;
  lines: JournalLine[];
  totalDebit: number;
}

export interface TrialBalanceRow { id: string; code: string; name: string; type: AccountType; debit: number; credit: number; balance: number }
export interface TrialBalance { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }

export interface StatementLine { code: string; name: string; amount: number }
export interface IncomeStatement { revenue: StatementLine[]; expense: StatementLine[]; totalRevenue: number; totalExpense: number; netProfit: number }
export interface BalanceSheet { assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[]; totalAssets: number; totalLiabilities: number; totalEquity: number; totalPassive: number }

export interface LedgerRow { no: string; entryDate: string; description: string; debit: number; credit: number; balance: number }
export interface GeneralLedger { account: { id: string; code: string; name: string; normalBalance: NormalBalance }; rows: LedgerRow[]; totalDebit: number; totalCredit: number; balance: number }

const BASE = "/api/branch/accounting";

export function fetchChart() {
  return apiFetch<{ accounts: ChartAccount[] }>(`${BASE}/accounts`, { cache: "no-store" });
}
export function createAccount(input: { code: string; name: string; type: AccountType; normalBalance: NormalBalance; parentCode?: string }) {
  return apiFetch<{ id: string }>(`${BASE}/accounts`, { method: "POST", body: JSON.stringify(input) });
}
export function fetchJournal(params?: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const qs = q.toString();
  return apiFetch<{ entries: JournalEntry[] }>(`${BASE}/journal${qs ? `?${qs}` : ""}`, { cache: "no-store" });
}
export function createJournalEntry(input: { entryDate: string; description: string; lines: { code: string; debit?: number; credit?: number; description?: string }[] }) {
  return apiFetch<{ id: string }>(`${BASE}/journal`, { method: "POST", body: JSON.stringify(input) });
}
export function deleteJournalEntry(id: string) {
  return apiFetch<{ ok: true }>(`${BASE}/journal/${id}`, { method: "DELETE" });
}

function reportUrl(report: string, params?: { from?: string; to?: string; accountId?: string }) {
  const q = new URLSearchParams({ report });
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.accountId) q.set("accountId", params.accountId);
  return `${BASE}/reports?${q.toString()}`;
}
export function fetchTrialBalance(params?: { from?: string; to?: string }) {
  return apiFetch<TrialBalance>(reportUrl("trial-balance", params), { cache: "no-store" });
}
export function fetchIncomeStatement(params?: { from?: string; to?: string }) {
  return apiFetch<IncomeStatement>(reportUrl("income-statement", params), { cache: "no-store" });
}
export function fetchBalanceSheet(params?: { from?: string; to?: string }) {
  return apiFetch<BalanceSheet>(reportUrl("balance-sheet", params), { cache: "no-store" });
}
export function fetchGeneralLedger(accountId: string, params?: { from?: string; to?: string }) {
  return apiFetch<GeneralLedger>(reportUrl("ledger", { ...params, accountId }), { cache: "no-store" });
}

export interface CariRow { accountId: string; code: string; name: string; balance: number; studentId?: string | null; supplierId?: string | null }
export interface CariData { students: CariRow[]; suppliers: CariRow[] }
export function fetchCari() {
  return apiFetch<CariData>(`${BASE}/cari`, { cache: "no-store" });
}

export interface CashAccount { code: string; name: string; balance: number }
export function fetchCashAccounts() {
  return apiFetch<{ accounts: CashAccount[]; total: number }>(`${BASE}/cash`, { cache: "no-store" });
}
export function cashTransfer(input: { fromCode: string; toCode: string; amount: number }) {
  return apiFetch<{ ok: true }>(`${BASE}/cash`, { method: "POST", body: JSON.stringify(input) });
}

export interface Supplier { id: string; name: string; taxNo: string | null; phone: string | null; email: string | null; note: string | null }
export function fetchSuppliers() {
  return apiFetch<{ suppliers: Supplier[] }>(`${BASE}/suppliers`, { cache: "no-store" });
}
export function createSupplier(input: { name: string; taxNo?: string; phone?: string; email?: string; note?: string }) {
  return apiFetch<{ id: string }>(`${BASE}/suppliers`, { method: "POST", body: JSON.stringify(input) });
}

export function runBackfill() {
  return apiFetch<{ accrued: number; collected: number; skipped: number; students: number }>(`${BASE}/backfill`, { method: "POST" });
}

export interface BudgetRow { code: string; name: string; type: AccountType; planned: number; actual: number }
export function fetchBudget(year: number) {
  return apiFetch<{ year: number; rows: BudgetRow[] }>(`${BASE}/budget?year=${year}`, { cache: "no-store" });
}
export function setBudget(input: { year: number; accountCode: string; plannedAmount: number }) {
  return apiFetch<{ ok: true }>(`${BASE}/budget`, { method: "POST", body: JSON.stringify(input) });
}

export const doubleAccountingKeys = {
  cari: () => ["acc2", "cari"] as const,
  cash: () => ["acc2", "cash"] as const,
  suppliers: () => ["acc2", "suppliers"] as const,
  budget: (year: number) => ["acc2", "budget", year] as const,
  chart: () => ["acc2", "chart"] as const,
  journal: (from?: string, to?: string) => ["acc2", "journal", from ?? "", to ?? ""] as const,
  trial: (from?: string, to?: string) => ["acc2", "trial", from ?? "", to ?? ""] as const,
  income: (from?: string, to?: string) => ["acc2", "income", from ?? "", to ?? ""] as const,
  balance: (from?: string, to?: string) => ["acc2", "balance", from ?? "", to ?? ""] as const,
  ledger: (accountId: string, from?: string, to?: string) => ["acc2", "ledger", accountId, from ?? "", to ?? ""] as const,
};

export function tl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
