import { apiFetch } from "./client";

export interface SelfInstallmentRow {
  id: string;
  installmentNo: number;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  paidAt: string | null;
}

export function fetchStudentInstallments(studentId: string) {
  return apiFetch<{ studentId: string; installments: SelfInstallmentRow[] }>(`/api/students/${studentId}/installments`, {
    cache: "no-store",
  });
}

export function paySelfInstallment(studentId: string, installmentId: string) {
  return apiFetch<{ installment: SelfInstallmentRow }>(`/api/students/${studentId}/installments/${installmentId}/pay`, {
    method: "POST",
  });
}
