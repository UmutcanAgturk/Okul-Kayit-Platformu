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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Kayıt Ekle</h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tür</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "GELIR" | "GIDER")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="GELIR">Gelir</option>
                  <option value="GIDER">Gider</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tarih</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kategori</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Örn. Kira, Personel Maaşı, Taksit Tahsilatı"
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

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={vatExempt} onChange={(e) => setVatExempt(e.target.checked)} />
              KDV'den istisna (3065 sayılı KDV Kanunu 17/2-b — eğitim/öğretim hizmeti)
            </label>
            {!vatExempt && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">KDV Oranı (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={vatRatePct}
                  onChange={(e) => setVatRatePct(e.target.value)}
                  className="mt-1 w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={withholdingOn} onChange={(e) => setWithholdingOn(e.target.checked)} />
              GVK md 94 stopajına tabi (örn. işyeri kira gideri)
            </label>
            {withholdingOn && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Stopaj Oranı (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={withholdingPct}
                  onChange={(e) => setWithholdingPct(e.target.value)}
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
              {createMutation.isPending ? "Ekleniyor…" : "Kaydı Ekle"}
            </button>
          </form>
        </div>

        {vat && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">KDV Özeti</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <dt>Hesaplanan KDV</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-50">{tl(vat.hesaplananKdv)}</dd>
              <dt>İndirilecek KDV</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-50">{tl(vat.indirilecekKdv)}</dd>
              <dt>Ödenecek KDV</dt>
              <dd className="text-right font-medium text-red-600 dark:text-red-400">{tl(vat.odenecekKdv)}</dd>
              <dt>Devreden KDV</dt>
              <dd className="text-right font-medium text-emerald-600 dark:text-emerald-400">{tl(vat.devredenKdv)}</dd>
            </dl>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Kayıt Defteri</h2>
          {summary && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Gelir {tl(summary.totalGelir)} · Gider {tl(summary.totalGider)} · Net {tl(summary.net)}
            </span>
          )}
        </div>

        {ledgerQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!ledgerQuery.isLoading && entries.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Henüz gelir/gider kaydı yok. Soldaki formdan ilk kaydınızı ekleyin.
          </p>
        )}

        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800"
            >
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-50">{entry.category}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(entry.entryDate).toLocaleDateString("tr-TR")}
                  {entry.vatRate !== null && ` · KDV %${Math.round(Number(entry.vatRate) * 100)}`}
                  {entry.withholdingRate !== null && ` · Stopaj %${Math.round(Number(entry.withholdingRate) * 100)}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={entry.type === "GELIR" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-600 dark:text-red-400"}
                >
                  {entry.type === "GELIR" ? "+" : "-"}
                  {tl(Number(entry.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(entry.id)}
                  className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
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
