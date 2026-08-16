"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountingKeys,
  createLedgerEntry,
  deleteLedgerEntry,
  fetchLedger,
  fetchVatSummary,
  updateLedgerEntry,
} from "@/lib/api/accounting";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import { DualLineChart } from "@/components/ui/charts/DualLineChart";
import type { LedgerEntry } from "@/lib/api/accounting";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

const MONTH_LABEL = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function buildMonthlyTrend(entries: LedgerEntry[]) {
  const byMonth = new Map<string, { a: number; b: number }>();
  for (const e of entries) {
    const d = new Date(e.entryDate);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = byMonth.get(key) ?? { a: 0, b: 0 };
    if (e.type === "GELIR") bucket.a += Number(e.amount);
    else bucket.b += Number(e.amount);
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, v]) => {
      const [year, month] = key.split("-").map(Number);
      return { label: `${MONTH_LABEL[month]} ${year}`, a: v.a, b: v.b };
    });
}

interface EditState {
  type: "GELIR" | "GIDER";
  category: string;
  amount: string;
  entryDate: string;
  note: string;
  vatExempt: boolean;
  vatRatePct: string;
  withholdingOn: boolean;
  withholdingPct: string;
}

function toEditState(entry: LedgerEntry): EditState {
  return {
    type: entry.type,
    category: entry.category,
    amount: String(Number(entry.amount)),
    entryDate: entry.entryDate.slice(0, 10),
    note: entry.note ?? "",
    vatExempt: entry.vatRate === null,
    vatRatePct: entry.vatRate !== null ? String(Math.round(Number(entry.vatRate) * 100)) : "20",
    withholdingOn: entry.withholdingRate !== null,
    withholdingPct: entry.withholdingRate !== null ? String(Math.round(Number(entry.withholdingRate) * 100)) : "20",
  };
}

export function LedgerPanel() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<"" | "GELIR" | "GIDER">("");
  const [filterSearch, setFilterSearch] = useState("");
  const ledgerFilter = { type: filterType || undefined, search: filterSearch.trim() || undefined };
  const ledgerQuery = useQuery({
    queryKey: accountingKeys.ledger(ledgerFilter),
    queryFn: () => fetchLedger(ledgerFilter),
  });
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  function invalidateLedger() {
    queryClient.invalidateQueries({ queryKey: ["accounting", "ledger"] });
    queryClient.invalidateQueries({ queryKey: accountingKeys.vatSummary() });
  }

  const createMutation = useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: () => {
      invalidateLedger();
      setCategory("");
      setAmount("");
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kayıt eklenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLedgerEntry,
    onSuccess: invalidateLedger,
  });

  const updateMutation = useMutation({
    mutationFn: (input: { entryId: string; data: Parameters<typeof updateLedgerEntry>[1] }) =>
      updateLedgerEntry(input.entryId, input.data),
    onSuccess: () => {
      invalidateLedger();
      setEditingId(null);
      setEditState(null);
      setEditError(null);
    },
    onError: (err) => setEditError(err instanceof ApiError ? err.message : "Kayıt güncellenemedi."),
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

  function startEdit(entry: LedgerEntry) {
    setEditingId(entry.id);
    setEditState(toEditState(entry));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setEditError(null);
  }

  function handleEditSubmit(e: React.FormEvent, entryId: string) {
    e.preventDefault();
    if (!editState) return;
    const amountNum = Number(editState.amount);
    if (!editState.category.trim() || !amountNum || amountNum <= 0) {
      setEditError("Kategori ve pozitif bir tutar zorunludur.");
      return;
    }
    updateMutation.mutate({
      entryId,
      data: {
        type: editState.type,
        category: editState.category.trim(),
        amount: amountNum,
        entryDate: editState.entryDate,
        note: editState.note.trim() || undefined,
        vatRate: !editState.vatExempt ? Number(editState.vatRatePct) / 100 : null,
        withholdingRate: editState.withholdingOn ? Number(editState.withholdingPct) / 100 : null,
      },
    });
  }

  const entries = ledgerQuery.data?.entries ?? [];
  const summary = ledgerQuery.data?.summary;
  const vat = vatQuery.data?.summary;
  const trend = buildMonthlyTrend(entries);

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

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {trend.length >= 2 && (
        <div className="card card-pad">
          <div className="card-head">
            <h3>Gelir/Gider Trendi</h3>
          </div>
          <DualLineChart points={trend} colorA="var(--strong)" colorB="var(--critical)" labelA="Gelir" labelB="Gider" height={130} />
        </div>
      )}
      <div className="card card-pad">
        <div className="card-head">
          <h3>Kayıt Defteri</h3>
          {summary && (
            <span className="hint">
              Gelir {tl(summary.totalGelir)} · Gider {tl(summary.totalGider)} · Net {tl(summary.net)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select
            aria-label="Tür filtresi"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "" | "GELIR" | "GIDER")}
            style={{ maxWidth: 150 }}
          >
            <option value="">Tümü</option>
            <option value="GELIR">Yalnızca Gelir</option>
            <option value="GIDER">Yalnızca Gider</option>
          </select>
          <input
            aria-label="Kategori ara"
            placeholder="Kategoriye göre ara…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {ledgerQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!ledgerQuery.isLoading && entries.length === 0 && (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>
              {filterType || filterSearch
                ? "Filtreye uyan kayıt bulunamadı."
                : "Henüz gelir/gider kaydı yok. Soldaki formdan ilk kaydınızı ekleyin."}
            </p>
          </div>
        )}

        <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {entries.map((entry) =>
            editingId === entry.id && editState ? (
              <form
                key={entry.id}
                onSubmit={(e) => handleEditSubmit(e, entry.id)}
                style={{ display: "flex", flexDirection: "column", gap: 8, borderBottom: "1px solid var(--border)", padding: "9px 0" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="field">
                    <label>Tür</label>
                    <select
                      value={editState.type}
                      onChange={(e) => setEditState({ ...editState, type: e.target.value as "GELIR" | "GIDER" })}
                    >
                      <option value="GELIR">Gelir</option>
                      <option value="GIDER">Gider</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Tarih</label>
                    <input type="date" value={editState.entryDate} onChange={(e) => setEditState({ ...editState, entryDate: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Kategori</label>
                  <input value={editState.category} onChange={(e) => setEditState({ ...editState, category: e.target.value })} />
                </div>
                <div className="field">
                  <label>Tutar (₺)</label>
                  <input type="number" min="0" value={editState.amount} onChange={(e) => setEditState({ ...editState, amount: e.target.value })} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  <input
                    type="checkbox"
                    checked={editState.vatExempt}
                    onChange={(e) => setEditState({ ...editState, vatExempt: e.target.checked })}
                  />
                  KDV&apos;den istisna
                </label>
                {!editState.vatExempt && (
                  <div className="field" style={{ width: 128 }}>
                    <label>KDV Oranı (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editState.vatRatePct}
                      onChange={(e) => setEditState({ ...editState, vatRatePct: e.target.value })}
                    />
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  <input
                    type="checkbox"
                    checked={editState.withholdingOn}
                    onChange={(e) => setEditState({ ...editState, withholdingOn: e.target.checked })}
                  />
                  GVK md 94 stopajına tabi
                </label>
                {editState.withholdingOn && (
                  <div className="field" style={{ width: 128 }}>
                    <label>Stopaj Oranı (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editState.withholdingPct}
                      onChange={(e) => setEditState({ ...editState, withholdingPct: e.target.value })}
                    />
                  </div>
                )}
                <div className="field">
                  <label>Not (opsiyonel)</label>
                  <input value={editState.note} onChange={(e) => setEditState({ ...editState, note: e.target.value })} />
                </div>
                {editError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{editError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={updateMutation.isPending} className="btn primary xs">
                    {updateMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                  <button type="button" onClick={cancelEdit} className="btn xs">
                    Vazgeç
                  </button>
                </div>
              </form>
            ) : (
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
                  <button type="button" onClick={() => startEdit(entry)} className="btn xs" aria-label="Düzenle">
                    Düzenle
                  </button>
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
            ),
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
