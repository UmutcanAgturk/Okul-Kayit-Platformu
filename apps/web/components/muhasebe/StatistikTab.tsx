"use client";

import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchLedger, type LedgerEntry } from "@/lib/api/accounting";
import { HBarChart } from "@/components/ui/charts/HBarChart";
import { DualLineChart } from "@/components/ui/charts/DualLineChart";

const MONTH_NAMES_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

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
 * Aylık Gelir/Gider Trendi — demo'daki ledgerMonthlyTrend()'in gerçek
 * karşılığı: Kayıt Defteri'ndeki gerçek kayıtları ay bazında gruplayıp son 6
 * ayı kronolojik sırada döndürür.
 */
function monthlyTrend(entries: LedgerEntry[]) {
  const map = new Map<string, { monthIdx: number; gelir: number; gider: number }>();
  for (const e of entries) {
    const d = new Date(e.entryDate);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const bucket = map.get(key) ?? { monthIdx: d.getMonth(), gelir: 0, gider: 0 };
    if (e.type === "GELIR") bucket.gelir += Number(e.amount);
    else bucket.gider += Number(e.amount);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, m]) => ({ month: MONTH_NAMES_TR[m.monthIdx], gelir: m.gelir, gider: m.gider }));
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
  const trend = monthlyTrend(entries);

  if (ledgerQuery.isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  return (
    <div>
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
      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Aylık Gelir / Gider Trendi</h3>
          <span className="hint">Son {trend.length} ay</span>
        </div>
        {trend.length >= 2 ? (
          <DualLineChart
            points={trend.map((m) => ({ label: m.month, a: m.gelir, b: m.gider }))}
            colorA="var(--strong)"
            colorB="var(--critical)"
            labelA="Gelir"
            labelB="Gider"
          />
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Trend göstermek için Kayıt Defteri&apos;ne en az iki farklı aydan kayıt ekleyin.</p>
        )}
      </div>
    </div>
  );
}
