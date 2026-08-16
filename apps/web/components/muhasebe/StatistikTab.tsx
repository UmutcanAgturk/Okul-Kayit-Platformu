"use client";

import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchLedger, type LedgerEntry } from "@/lib/api/accounting";
import { HBarChart } from "@/components/ui/charts/HBarChart";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

function categoryBreakdown(entries: LedgerEntry[], type: "GELIR" | "GIDER") {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== type) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/**
 * Muhasebe — İstatistikler. demo'daki muhasebeSubTab==="istatistik"in
 * karşılığı: Kayıt Defteri'ndeki (bkz. LedgerPanel) gerçek verinin
 * kategori bazlı kırılımı.
 */
export function StatistikTab() {
  const ledgerQuery = useQuery({ queryKey: accountingKeys.ledger(), queryFn: () => fetchLedger() });
  const entries = ledgerQuery.data?.entries ?? [];
  const gelirCats = categoryBreakdown(entries, "GELIR");
  const giderCats = categoryBreakdown(entries, "GIDER");

  if (ledgerQuery.isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  return (
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Gelir Kategorileri</h3>
          <span className="hint">₺ toplam</span>
        </div>
        {gelirCats.length ? (
          <HBarChart rows={gelirCats.map((c) => ({ label: c.category, value: c.amount, valueLabel: tl(c.amount), tone: "strong" }))} />
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz gelir kaydı yok.</p>
        )}
      </div>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Gider Kategorileri</h3>
          <span className="hint">₺ toplam</span>
        </div>
        {giderCats.length ? (
          <HBarChart rows={giderCats.map((c) => ({ label: c.category, value: c.amount, valueLabel: tl(c.amount), tone: "critical" }))} />
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz gider kaydı yok.</p>
        )}
      </div>
    </div>
  );
}
