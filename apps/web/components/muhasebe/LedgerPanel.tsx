"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountingKeys,
  createLedgerEntry,
  deleteLedgerEntry,
  fetchLedger,
  fetchVatSummary,
} from "@/lib/api/accounting";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

export function LedgerPanel() {
  const queryClient = useQueryClient();
  const ledgerQuery = useQuery({ queryKey: accountingKeys.ledger(), queryFn: fetchLedger });
  const vatQuery = useQuery({ queryKey: accountingKeys.vatSummary(), queryFn: fetchVatSummary });

  const [type, setType] = useState<"GELIR" | "GIDER">("GELIR");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [vatExempt, setVatExempt] = useState(true);
  const [vatRatePct, setVatRatePct] = useState("20");
  const [withholdingOn, setWithholdingOn] = useState(false);
  const [withholdingPct, setWithholdingPct] = useState("20");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.ledger() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.vatSummary() });
      setCategory("");
      setAmount("");
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kayıt eklenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLedgerEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.ledger() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.vatSummary() });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!category.trim() || !amountNum || amountNum <= 0) {
      setFormError("Kategori ve pozitif bir tutar zorunludur.");
      return;
    }
    createMutation.mutate({
      type,
      category: category.trim(),
      amount: amountNum,
      entryDate,
      note: note.trim() || undefined,
      vatRate: !vatExempt ? Number(vatRatePct) / 100 : null,
      withholdingRate: withholdingOn ? Number(withholdingPct) / 100 : null,
    });
  }

  const entries = ledgerQuery.data?.entries ?? [];
  const summary = ledgerQuery.data?.summary;
  const vat = vatQuery.data?.summary;

  return (
    <div className="grid cols-2">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Yeni Kayıt Ekle</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label>Tür</label>
                <select value={type} onChange={(e) => setType(e.target.value as "GELIR" | "GIDER")}>
                  <option value="GELIR">Gelir</option>
                  <option value="GIDER">Gider</option>
                </select>
              </div>
              <div className="field">
                <label>Tarih</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Kategori</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Örn. Kira, Personel Maaşı, Taksit Tahsilatı"
              />
            </div>
            <div className="field">
              <label>Tutar (₺)</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              <input type="checkbox" checked={vatExempt} onChange={(e) => setVatExempt(e.target.checked)} />
              KDV'den istisna (3065 sayılı KDV Kanunu 17/2-b — eğitim/öğretim hizmeti)
            </label>
            {!vatExempt && (
              <div className="field" style={{ width: 128 }}>
                <label>KDV Oranı (%)</label>
                <input type="number" min="0" max="100" value={vatRatePct} onChange={(e) => setVatRatePct(e.target.value)} />
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              <input type="checkbox" checked={withholdingOn} onChange={(e) => setWithholdingOn(e.target.checked)} />
              GVK md 94 stopajına tabi (örn. işyeri kira gideri)
            </label>
            {withholdingOn && (
              <div className="field" style={{ width: 128 }}>
                <label>Stopaj Oranı (%)</label>
                <input type="number" min="0" max="100" value={withholdingPct} onChange={(e) => setWithholdingPct(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label>Not (opsiyonel)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

            <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
              {createMutation.isPending ? "Ekleniyor…" : "Kaydı Ekle"}
            </button>
          </form>
        </div>

        {vat && (
          <div className="card card-pad">
            <div className="card-head">
              <h3>KDV Özeti</h3>
            </div>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              <dt>Hesaplanan KDV</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>{tl(vat.hesaplananKdv)}</dd>
              <dt>İndirilecek KDV</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>{tl(vat.indirilecekKdv)}</dd>
              <dt>Ödenecek KDV</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600, color: "var(--critical)" }}>{tl(vat.odenecekKdv)}</dd>
              <dt>Devreden KDV</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600, color: "var(--strong)" }}>{tl(vat.devredenKdv)}</dd>
            </dl>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Kayıt Defteri</h3>
          {summary && (
            <span className="hint">
              Gelir {tl(summary.totalGelir)} · Gider {tl(summary.totalGider)} · Net {tl(summary.net)}
            </span>
          )}
        </div>

        {ledgerQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!ledgerQuery.isLoading && entries.length === 0 && (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>Henüz gelir/gider kaydı yok. Soldaki formdan ilk kaydınızı ekleyin.</p>
          </div>
        )}

        <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
            >
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{entry.category}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {new Date(entry.entryDate).toLocaleDateString("tr-TR")}
                  {entry.vatRate !== null && ` · KDV %${Math.round(Number(entry.vatRate) * 100)}`}
                  {entry.withholdingRate !== null && ` · Stopaj %${Math.round(Number(entry.withholdingRate) * 100)}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 700, color: entry.type === "GELIR" ? "var(--strong)" : "var(--critical)" }}>
                  {entry.type === "GELIR" ? "+" : "-"}
                  {tl(Number(entry.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(entry.id)}
                  className="btn xs"
                  aria-label="Sil"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
