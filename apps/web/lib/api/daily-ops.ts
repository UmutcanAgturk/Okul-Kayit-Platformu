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
  staffAttendance: () => ["daily-ops", "staff-attendance"] as const,
};

export type StaffAttendanceClientStatus = "GELDI" | "GELMEDI" | "IZINLI";

export interface StaffAttendanceRow {
  userId: string;
  name: string;
  title: string;
  status: StaffAttendanceClientStatus;
}

export interface StaffAttendance {
  date: string;
  staff: StaffAttendanceRow[];
  presentCount: number;
  totalCount: number;
}

export function fetchStaffAttendance() {
  return apiFetch<StaffAttendance>("/api/branch/staff-attendance", { cache: "no-store" });
}

export function setStaffAttendance(userId: string, status: StaffAttendanceClientStatus) {
  return apiFetch<{ userId: string; status: StaffAttendanceClientStatus; date: string }>("/api/branch/staff-attendance", {
    method: "POST",
    body: JSON.stringify({ userId, status }),
  });
}
