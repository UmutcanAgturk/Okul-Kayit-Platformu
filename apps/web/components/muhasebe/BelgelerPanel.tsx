"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvoice,
  createPromissoryNote,
  createReceipt,
  deleteInvoice,
  deletePromissoryNote,
  deleteReceipt,
  documentKeys,
  fetchInvoices,
  fetchPromissoryNotes,
  fetchReceipts,
  markPromissoryNotePaid,
  ReceiptMethod,
  ReceiptType,
} from "@/lib/api/documents";
import { ApiError } from "@/lib/api/client";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

const SUB_TABS = [
  { id: "fatura", label: "Fatura" },
  { id: "dekont", label: "Dekont" },
  { id: "senet", label: "Senet" },
] as const;
type SubTabId = (typeof SUB_TABS)[number]["id"];

const RECEIPT_METHOD_LABEL: Record<ReceiptMethod, string> = {
  KREDI_KARTI: "Kredi Kartı",
  BANKA_HAVALESI: "Banka Havalesi",
  NAKIT: "Nakit",
  SENET: "Senet",
};

/**
 * Fatura/Dekont/Senet — demo/seviye360-app.html'deki Belgeler sekmesinin
 * gerçek (Postgres'e bağlı) karşılığı. Kayıt Defteri'nden BİLİNÇLİ OLARAK
 * bağımsızdır (bkz. prisma/schema.prisma'daki "BELGELER" yorumu) — burada
 * oluşturulan bir belge deftere otomatik yansımaz.
 */
export function BelgelerPanel() {
  const [subTab, setSubTab] = useState<SubTabId>("fatura");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={
              "border-b-2 px-3 py-1.5 text-xs font-medium transition " +
              (subTab === t.id
                ? "border-[#0071ce] text-[#0071ce]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Bu belgeler Kayıt Defteri&apos;nden bağımsızdır — oluşturduğunuzda veya sildiğinizde defterdeki hiçbir kayıt
        değişmez. Deftere yansıtmak isterseniz Genel Bakış sekmesinden ayrıca manuel bir kayıt ekleyin.
      </p>
      {subTab === "fatura" && <FaturaTab />}
      {subTab === "dekont" && <DekontTab />}
      {subTab === "senet" && <SenetTab />}
    </div>
  );
}

function FaturaTab() {
  const queryClient = useQueryClient();
  const invoicesQuery = useQuery({ queryKey: documentKeys.invoices(), queryFn: fetchInvoices });

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [buyerName, setBuyerName] = useState("");
  const [buyerTaxNo, setBuyerTaxNo] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [kdvExempt, setKdvExempt] = useState(true);
  const [kdvRatePct, setKdvRatePct] = useState("20");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.invoices() });
      setBuyerName("");
      setBuyerTaxNo("");
      setBuyerAddress("");
      setNote("");
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Fatura oluşturulamadı."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.invoices() }),
  });

  function updateItem(index: number, patch: Partial<{ description: string; quantity: number; unitPrice: number }>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((it) => it.description.trim() && it.quantity > 0 && it.unitPrice > 0);
    if (!buyerName.trim() || validItems.length === 0) {
      setFormError("Alıcı adı ve en az bir geçerli kalem (açıklama, miktar>0, birim fiyat>0) zorunludur.");
      return;
    }
    createMutation.mutate({
      invoiceDate,
      buyerName: buyerName.trim(),
      buyerTaxNo: buyerTaxNo.trim() || undefined,
      buyerAddress: buyerAddress.trim() || undefined,
      items: validItems,
      kdvExempt,
      kdvRate: !kdvExempt ? Number(kdvRatePct) / 100 : null,
      note: note.trim() || undefined,
    });
  }

  const invoices = invoicesQuery.data?.invoices ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Fatura Oluştur</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tarih</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Alıcı Vergi No</label>
              <input
                value={buyerTaxNo}
                onChange={(e) => setBuyerTaxNo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Alıcı Adı</label>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Alıcı Adresi (opsiyonel)</label>
            <input
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kalemler</label>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_80px_auto] gap-2">
                <input
                  value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Açıklama"
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  min="0"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-30 dark:hover:text-red-400"
                >
                  Sil
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])}
              className="text-xs font-medium text-[#0071ce] hover:underline"
            >
              + Kalem Ekle
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={kdvExempt} onChange={(e) => setKdvExempt(e.target.checked)} />
            KDV&apos;den istisna (KDV Kanunu 17/2-b — eğitim/öğretim hizmeti)
          </label>
          {!kdvExempt && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">KDV Oranı (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={kdvRatePct}
                onChange={(e) => setKdvRatePct(e.target.value)}
                className="mt-1 w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Not (opsiyonel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {createMutation.isPending ? "Kesiliyor…" : "Faturayı Kes"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Kesilen Faturalar</h2>
        {invoicesQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!invoicesQuery.isLoading && invoices.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz fatura kesilmedi.</p>
        )}
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
          {invoices.map((inv) => (
            <div key={inv.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {inv.no} · {inv.buyerName}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{tl(Number(inv.total))}</span>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(inv.id)}
                    className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(inv.invoiceDate).toLocaleDateString("tr-TR")}
                {inv.kdvRate !== null ? ` · KDV %${Math.round(Number(inv.kdvRate) * 100)}` : " · KDV'den istisna"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DekontTab() {
  const queryClient = useQueryClient();
  const receiptsQuery = useQuery({ queryKey: documentKeys.receipts(), queryFn: fetchReceipts });

  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<ReceiptType>("TAHSILAT");
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ReceiptMethod>("NAKIT");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.receipts() });
      setPersonName("");
      setAmount("");
      setDescription("");
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Dekont oluşturulamadı."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.receipts() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!personName.trim() || !amountNum || amountNum <= 0) {
      setFormError("Kişi adı ve pozitif bir tutar zorunludur.");
      return;
    }
    createMutation.mutate({
      receiptDate,
      type,
      personName: personName.trim(),
      amount: amountNum,
      method,
      description: description.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  const receipts = receiptsQuery.data?.receipts ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Dekont Oluştur</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tür</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReceiptType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="TAHSILAT">Tahsilat</option>
                <option value="ODEME">Ödeme</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tarih</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {type === "TAHSILAT" ? "Tahsil Edilen Kişi" : "Ödeme Yapılan Kişi"}
            </label>
            <input
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tutar (₺)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Yöntem</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ReceiptMethod)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(RECEIPT_METHOD_LABEL) as ReceiptMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {RECEIPT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Açıklama (opsiyonel)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Not (opsiyonel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Dekontu Oluştur"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Dekontlar</h2>
        {receiptsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!receiptsQuery.isLoading && receipts.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz dekont oluşturulmadı.</p>
        )}
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
          {receipts.map((r) => (
            <div key={r.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {r.no} · {r.personName}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      r.type === "TAHSILAT"
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {r.type === "TAHSILAT" ? "+" : "-"}
                    {tl(Number(r.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(r.id)}
                    className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(r.receiptDate).toLocaleDateString("tr-TR")} · {RECEIPT_METHOD_LABEL[r.method]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SenetTab() {
  const queryClient = useQueryClient();
  const notesQuery = useQuery({ queryKey: documentKeys.promissoryNotes(), queryFn: fetchPromissoryNotes });

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createPromissoryNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.promissoryNotes() });
      setDebtorName("");
      setAmount("");
      setDueDate("");
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Senet oluşturulamadı."),
  });
  const deleteMutation = useMutation({
    mutationFn: deletePromissoryNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.promissoryNotes() }),
  });
  const markPaidMutation = useMutation({
    mutationFn: markPromissoryNotePaid,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.promissoryNotes() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!debtorName.trim() || !dueDate || !amountNum || amountNum <= 0) {
      setFormError("Borçlu adı, vade tarihi ve pozitif bir tutar zorunludur.");
      return;
    }
    createMutation.mutate({
      issueDate,
      dueDate,
      debtorName: debtorName.trim(),
      amount: amountNum,
      note: note.trim() || undefined,
    });
  }

  const notes = notesQuery.data?.notes ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Senet Oluştur</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Düzenleme Tarihi</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Vade Tarihi</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Borçlu Adı</label>
            <input
              value={debtorName}
              onChange={(e) => setDebtorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tutar (₺)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Not (opsiyonel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Senedi Oluştur"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Senetler</h2>
        {notesQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!notesQuery.isLoading && notes.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz senet oluşturulmadı.</p>
        )}
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {n.no} · {n.debtorName}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{tl(Number(n.amount))}</span>
                  <span
                    className={
                      n.status === "ODENDI"
                        ? "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                    }
                  >
                    {n.status === "ODENDI" ? "Ödendi" : "Ödenmedi"}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Vade: {new Date(n.dueDate).toLocaleDateString("tr-TR")}</span>
                <div className="flex items-center gap-3">
                  {n.status === "ODENMEDI" && (
                    <button
                      type="button"
                      onClick={() => markPaidMutation.mutate(n.id)}
                      className="text-xs font-medium text-[#0071ce] hover:underline"
                    >
                      Ödendi İşaretle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(n.id)}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
