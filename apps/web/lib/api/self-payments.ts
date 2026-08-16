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

export type PaymentReceiptStatus = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";

export interface SelfPaymentReceiptRow {
  id: string;
  installmentId: string;
  fileName: string;
  note: string | null;
  status: PaymentReceiptStatus;
  submittedAt: string;
  reviewedAt: string | null;
}

export function fetchSelfPaymentReceipts(studentId: string) {
  return apiFetch<{ receipts: SelfPaymentReceiptRow[] }>(`/api/students/${studentId}/payment-receipts`, { cache: "no-store" });
}

export function submitPaymentReceipt(
  studentId: string,
  input: { installmentId: string; fileName: string; mimeType: string; dataUrl: string; note?: string },
) {
  return apiFetch<{ receipt: SelfPaymentReceiptRow }>(`/api/students/${studentId}/payment-receipts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
