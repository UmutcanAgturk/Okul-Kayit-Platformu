import { apiFetch } from "./client";

export interface PaymentMethodRow {
  id: string;
  type: "KREDI_KARTI" | "BANKA_HAVALESI" | "NAKIT";
  provider: string;
  maskedCardNumber: string | null;
  isDefault: boolean;
  createdAt: string;
}

export const PAYMENT_METHOD_TYPE_LABEL: Record<PaymentMethodRow["type"], string> = {
  KREDI_KARTI: "Kredi Kartı",
  BANKA_HAVALESI: "Banka Havalesi",
  NAKIT: "Nakit",
};

export function fetchPaymentMethods(studentId: string) {
  return apiFetch<{ methods: PaymentMethodRow[] }>(`/api/branch/students/${studentId}/payment-methods`, { cache: "no-store" });
}

export function createPaymentMethod(
  studentId: string,
  input: { type: PaymentMethodRow["type"]; provider?: string; maskedCardNumber?: string; isDefault?: boolean },
) {
  return apiFetch<{ method: PaymentMethodRow }>(`/api/branch/students/${studentId}/payment-methods`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePaymentMethod(studentId: string, methodId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/students/${studentId}/payment-methods/${methodId}`, { method: "DELETE" });
}
