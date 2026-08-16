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

export type InstitutionPaymentMethodType = "KREDI_KARTI" | "BANKA_HAVALESI" | "NAKIT" | "SENET";

export interface InstitutionPaymentMethodRow {
  id: string;
  type: InstitutionPaymentMethodType;
  label: string;
  extra: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export const INSTITUTION_PAYMENT_METHOD_TYPE_LABEL: Record<InstitutionPaymentMethodType, string> = {
  KREDI_KARTI: "Kredi Kartı (ParamPOS)",
  BANKA_HAVALESI: "Banka Havalesi",
  NAKIT: "Nakit",
  SENET: "Senet",
};

export const INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL: Record<InstitutionPaymentMethodType, string> = {
  KREDI_KARTI: "Komisyon Oranı (%)",
  BANKA_HAVALESI: "IBAN",
  NAKIT: "Teslim Alma Noktası",
  SENET: "Senet Vade Notu",
};

export function fetchPaymentMethodCatalog() {
  return apiFetch<{ methods: InstitutionPaymentMethodRow[] }>("/api/branch/payment-method-catalog", { cache: "no-store" });
}

export function createPaymentMethodCatalogEntry(input: { type: InstitutionPaymentMethodType; label: string; extra?: string; isDefault?: boolean }) {
  return apiFetch<{ method: InstitutionPaymentMethodRow }>("/api/branch/payment-method-catalog", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePaymentMethodCatalogEntry(
  methodId: string,
  input: Partial<{ label: string; extra: string | null; isDefault: boolean; isActive: boolean }>,
) {
  return apiFetch<{ method: InstitutionPaymentMethodRow }>(`/api/branch/payment-method-catalog/${methodId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePaymentMethodCatalogEntry(methodId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/payment-method-catalog/${methodId}`, { method: "DELETE" });
}

export interface PendingReceiptRow {
  id: string;
  studentName: string;
  installmentNo: number;
  amount: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  note: string | null;
  status: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
  submittedAt: string;
}

export function fetchBranchPaymentReceipts() {
  return apiFetch<{ receipts: PendingReceiptRow[] }>("/api/branch/payment-receipts", { cache: "no-store" });
}

export function reviewPaymentReceipt(receiptId: string, decision: "APPROVE" | "REJECT") {
  return apiFetch<{ receipt: unknown }>(`/api/branch/payment-receipts/${receiptId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
