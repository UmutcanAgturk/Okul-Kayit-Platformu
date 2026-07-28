import { apiFetch } from "./client";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  no: string;
  invoiceDate: string;
  buyerName: string;
  buyerTaxNo: string | null;
  buyerAddress: string | null;
  items: InvoiceItem[];
  kdvRate: string | null;
  subtotal: string;
  kdvAmount: string;
  total: string;
  note: string | null;
  createdAt: string;
}

export function fetchInvoices() {
  return apiFetch<{ invoices: Invoice[] }>("/api/branch/invoices", { cache: "no-store" });
}

export function createInvoice(input: {
  invoiceDate: string;
  buyerName: string;
  buyerTaxNo?: string;
  buyerAddress?: string;
  items: InvoiceItem[];
  kdvExempt: boolean;
  kdvRate?: number | null;
  note?: string;
}) {
  return apiFetch<{ invoice: Invoice }>("/api/branch/invoices", { method: "POST", body: JSON.stringify(input) });
}

export function deleteInvoice(invoiceId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/invoices/${invoiceId}`, { method: "DELETE" });
}

export type ReceiptType = "TAHSILAT" | "ODEME";
export type ReceiptMethod = "KREDI_KARTI" | "BANKA_HAVALESI" | "NAKIT" | "SENET";

export interface Receipt {
  id: string;
  no: string;
  receiptDate: string;
  type: ReceiptType;
  personName: string;
  amount: string;
  method: ReceiptMethod;
  description: string | null;
  note: string | null;
  createdAt: string;
}

export function fetchReceipts() {
  return apiFetch<{ receipts: Receipt[] }>("/api/branch/receipts", { cache: "no-store" });
}

export function createReceipt(input: {
  receiptDate: string;
  type: ReceiptType;
  personName: string;
  amount: number;
  method: ReceiptMethod;
  description?: string;
  note?: string;
}) {
  return apiFetch<{ receipt: Receipt }>("/api/branch/receipts", { method: "POST", body: JSON.stringify(input) });
}

export function deleteReceipt(receiptId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/receipts/${receiptId}`, { method: "DELETE" });
}

export type PromissoryNoteStatus = "ODENMEDI" | "ODENDI";

export interface PromissoryNote {
  id: string;
  no: string;
  issueDate: string;
  dueDate: string;
  debtorName: string;
  amount: string;
  note: string | null;
  status: PromissoryNoteStatus;
  paidAt: string | null;
  studentId: string | null;
  createdAt: string;
}

export function fetchPromissoryNotes() {
  return apiFetch<{ notes: PromissoryNote[] }>("/api/branch/promissory-notes", { cache: "no-store" });
}

export function createPromissoryNote(input: {
  issueDate: string;
  dueDate: string;
  debtorName: string;
  amount: number;
  note?: string;
  studentId?: string;
}) {
  return apiFetch<{ promissoryNote: PromissoryNote }>("/api/branch/promissory-notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePromissoryNote(noteId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/promissory-notes/${noteId}`, { method: "DELETE" });
}

export function markPromissoryNotePaid(noteId: string) {
  return apiFetch<{ promissoryNote: PromissoryNote }>(`/api/branch/promissory-notes/${noteId}/mark-paid`, {
    method: "POST",
  });
}

export const documentKeys = {
  invoices: () => ["documents", "invoices"] as const,
  receipts: () => ["documents", "receipts"] as const,
  promissoryNotes: () => ["documents", "promissory-notes"] as const,
};
