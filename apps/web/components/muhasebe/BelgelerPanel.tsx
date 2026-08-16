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
  type Invoice,
  type PromissoryNote,
  type Receipt,
  ReceiptMethod,
  ReceiptType,
} from "@/lib/api/documents";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import { PrintDocumentViewer } from "@/components/documents/PrintDocumentViewer";
import { InvoicePrintBody, PromissoryNotePrintBody, ReceiptPrintBody } from "@/components/documents/DocumentPrintBodies";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`screen-tab ${subTab === t.id ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
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
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

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
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Fatura Oluştur</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Tarih</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Alıcı Vergi No</label>
              <input value={buyerTaxNo} onChange={(e) => setBuyerTaxNo(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Alıcı Adı</label>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          </div>
          <div className="field">
            <label>Alıcı Adresi (opsiyonel)</label>
            <input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>Kalemler</label>
            {items.map((it, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px auto", gap: 8, alignItems: "center" }}>
                <input
                  value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Açıklama"
                  style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: "var(--text-xs)" }}
                />
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: "var(--text-xs)" }}
                />
                <input
                  type="number"
                  min="0"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                  style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: "var(--text-xs)" }}
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="btn xs"
                >
                  Sil
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])}
              className="btn xs"
              style={{ alignSelf: "flex-start" }}
            >
              + Kalem Ekle
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            <input type="checkbox" checked={kdvExempt} onChange={(e) => setKdvExempt(e.target.checked)} />
            KDV&apos;den istisna (KDV Kanunu 17/2-b — eğitim/öğretim hizmeti)
          </label>
          {!kdvExempt && (
            <div className="field" style={{ width: 128 }}>
              <label>KDV Oranı (%)</label>
              <input type="number" min="0" max="100" value={kdvRatePct} onChange={(e) => setKdvRatePct(e.target.value)} />
            </div>
          )}

          <div className="field">
            <label>Not (opsiyonel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
            {createMutation.isPending ? "Kesiliyor…" : "Faturayı Kes"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Kesilen Faturalar</h3>
        </div>
        {invoicesQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!invoicesQuery.isLoading && invoices.length === 0 && (
          <div className="empty-state">
            <Icon name="cardIcon" />
            <p>Henüz fatura kesilmedi.</p>
          </div>
        )}
        <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {invoices.map((inv) => (
            <div key={inv.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                  {inv.no} · {inv.buyerName}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>{tl(Number(inv.total))}</span>
                  <button type="button" onClick={() => setPrintInvoice(inv)} className="btn xs">
                    Yazdır
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(inv.id)} className="btn xs">
                    Sil
                  </button>
                </div>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {new Date(inv.invoiceDate).toLocaleDateString("tr-TR")}
                {inv.kdvRate !== null ? ` · KDV %${Math.round(Number(inv.kdvRate) * 100)}` : " · KDV'den istisna"}
              </div>
            </div>
          ))}
        </div>
      </div>
      <PrintDocumentViewer open={!!printInvoice} onClose={() => setPrintInvoice(null)} documentNo={printInvoice?.no ?? ""}>
        {printInvoice && <InvoicePrintBody invoice={printInvoice} />}
      </PrintDocumentViewer>
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
  const [printReceipt, setPrintReceipt] = useState<Receipt | null>(null);

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
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Dekont Oluştur</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Tür</label>
              <select value={type} onChange={(e) => setType(e.target.value as ReceiptType)}>
                <option value="TAHSILAT">Tahsilat</option>
                <option value="ODEME">Ödeme</option>
              </select>
            </div>
            <div className="field">
              <label>Tarih</label>
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>{type === "TAHSILAT" ? "Tahsil Edilen Kişi" : "Ödeme Yapılan Kişi"}</label>
            <input value={personName} onChange={(e) => setPersonName(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Tutar (₺)</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Yöntem</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as ReceiptMethod)}>
                {(Object.keys(RECEIPT_METHOD_LABEL) as ReceiptMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {RECEIPT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Açıklama (opsiyonel)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Not (opsiyonel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
            {createMutation.isPending ? "Oluşturuluyor…" : "Dekontu Oluştur"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Dekontlar</h3>
        </div>
        {receiptsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!receiptsQuery.isLoading && receipts.length === 0 && (
          <div className="empty-state">
            <Icon name="attach" />
            <p>Henüz dekont oluşturulmadı.</p>
          </div>
        )}
        <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {receipts.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                  {r.no} · {r.personName}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700, color: r.type === "TAHSILAT" ? "var(--strong)" : "var(--critical)" }}>
                    {r.type === "TAHSILAT" ? "+" : "-"}
                    {tl(Number(r.amount))}
                  </span>
                  <button type="button" onClick={() => setPrintReceipt(r)} className="btn xs">
                    Yazdır
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(r.id)} className="btn xs">
                    Sil
                  </button>
                </div>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {new Date(r.receiptDate).toLocaleDateString("tr-TR")} · {RECEIPT_METHOD_LABEL[r.method]}
              </div>
            </div>
          ))}
        </div>
      </div>
      <PrintDocumentViewer open={!!printReceipt} onClose={() => setPrintReceipt(null)} documentNo={printReceipt?.no ?? ""}>
        {printReceipt && <ReceiptPrintBody receipt={printReceipt} />}
      </PrintDocumentViewer>
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
  const [printNote, setPrintNote] = useState<PromissoryNote | null>(null);

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
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Senet Oluştur</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Düzenleme Tarihi</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Vade Tarihi</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Borçlu Adı</label>
            <input value={debtorName} onChange={(e) => setDebtorName(e.target.value)} />
          </div>
          <div className="field">
            <label>Tutar (₺)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Not (opsiyonel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
            {createMutation.isPending ? "Oluşturuluyor…" : "Senedi Oluştur"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Senetler</h3>
        </div>
        {notesQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!notesQuery.isLoading && notes.length === 0 && (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>Henüz senet oluşturulmadı.</p>
          </div>
        )}
        <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                  {n.no} · {n.debtorName}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>{tl(Number(n.amount))}</span>
                  <span className={`chip ${n.status === "ODENDI" ? "strong" : "weak"}`}>
                    {n.status === "ODENDI" ? "Ödendi" : "Ödenmedi"}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                <span>Vade: {new Date(n.dueDate).toLocaleDateString("tr-TR")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {n.status === "ODENMEDI" && (
                    <button type="button" onClick={() => markPaidMutation.mutate(n.id)} className="btn xs">
                      Ödendi İşaretle
                    </button>
                  )}
                  <button type="button" onClick={() => setPrintNote(n)} className="btn xs">
                    Yazdır
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(n.id)} className="btn xs">
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PrintDocumentViewer open={!!printNote} onClose={() => setPrintNote(null)} documentNo={printNote?.no ?? ""}>
        {printNote && <PromissoryNotePrintBody note={printNote} />}
      </PrintDocumentViewer>
    </div>
  );
}
