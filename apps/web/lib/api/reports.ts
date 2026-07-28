import { apiFetch } from "./client";

export interface FinancialSummaryRow {
  type: "GELIR" | "GIDER";
  category: string;
  amount: number;
}

export interface FinancialSummary {
  rows: FinancialSummaryRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  recordCount: number;
}

export function fetchFinancialSummary() {
  return apiFetch<FinancialSummary>("/api/branch/reports/financial-summary", { cache: "no-store" });
}

// CSV raporları büyük olabileceği ve doğrudan dosya indirmesi tetiklediği
// için react-query yerine düz bir `<a download>` tetikleyicisi kullanılır —
// tarayıcı, apiFetch'in fırlattığı hataları JSON olarak yorumlamaya çalışmaz.
export function downloadReport(path: string) {
  const link = document.createElement("a");
  link.href = path;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const reportsKeys = {
  financialSummary: () => ["reports", "financial-summary"] as const,
};
