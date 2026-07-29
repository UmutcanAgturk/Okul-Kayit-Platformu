import { apiFetch } from "./client";

export interface OpsPaymentRow {
  installmentId: string;
  studentId: string;
  studentName: string;
  installmentNo: number;
  amount: number;
  dueDate: string;
  daysLate?: number;
}

export interface OpsEtutSlot {
  subject: string;
  time: string;
  count: number;
}

export interface DailyOps {
  date: string;
  overduePayments: OpsPaymentRow[];
  overdueTotal: number;
  upcomingPayments: OpsPaymentRow[];
  todayEtut: OpsEtutSlot[];
  todayEtutTotal: number;
}

export function fetchDailyOps() {
  return apiFetch<DailyOps>("/api/branch/daily-ops", { cache: "no-store" });
}

export const dailyOpsKeys = {
  all: () => ["daily-ops"] as const,
};
