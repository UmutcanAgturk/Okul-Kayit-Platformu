"use client";

import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchInstallments, fetchLedger, type LedgerEntry } from "@/lib/api/accounting";
import { HBarChart } from "@/components/ui/charts/HBarChart";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

function monthsSpanned(entries: LedgerEntry[]) {
  const keys = new Set(entries.map((e) => { const d = new Date(e.entryDate); return `${d.getFullYear()}-${d.getMonth()}`; }));
  return Math.max(keys.size, 1);
}

const FORECAST_SCENARIOS = [
  { key: "iyimser", label: "İyimser", tone: "strong" as const, tahsilat: 95, yeniKayit: 14, aciklama: "Tahsilat oranı %95'e çıkar, 14 yeni normal kayıt tamamlanır." },
  { key: "gercekci", label: "Gerçekçi", tone: "accent" as const, tahsilat: 85, yeniKayit: 8, aciklama: "Tahsilat oranı mevcut %85 seviyesinde kalır, 8 yeni kayıt beklenir." },
  { key: "kotumser", label: "Kötümser", tone: "critical" as const, tahsilat: 70, yeniKayit: 3, aciklama: "Tahsilat oranı %70'e geriler, yalnızca 3 yeni kayıt tamamlanır." },
];

/**
 * Muhasebe — Beklentiler. demo'daki muhasebeSubTab==="beklenti"nin
 * karşılığı: geçmiş ortalama gelir/gider VE gerçek bekleyen taksit
 * toplamından üç senaryolu (iyimser/gerçekçi/kötümser) önümüzdeki ay net
 * kâr TAHMİNİ. Tahsilat oranı/yeni kayıt varsayımları demo'daki gibi
 * açıkça SENARYO VARSAYIMI olarak sunulur — gerçek veri gibi gösterilmez.
 */
export function BeklentiTab() {
  const ledgerQuery = useQuery({ queryKey: accountingKeys.ledger(), queryFn: () => fetchLedger() });
  const pendingQuery = useQuery({ queryKey: accountingKeys.installments("PENDING"), queryFn: () => fetchInstallments("PENDING") });

  if (ledgerQuery.isLoading || pendingQuery.isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  const entries = ledgerQuery.data?.entries ?? [];
  const gelir = ledgerQuery.data?.summary.totalGelir ?? 0;
  const gider = ledgerQuery.data?.summary.totalGider ?? 0;
  const months = monthsSpanned(entries);
  const bekleyenTaksit = (pendingQuery.data?.installments ?? []).reduce((s, i) => s + Number(i.amount), 0);

  const scenarioNets = FORECAST_SCENARIOS.map((s) => {
    const gecmisOrtGelir = gelir / months;
    const tahsilatKatsayili = gecmisOrtGelir * (s.tahsilat / 85);
    const yeniKayitGeliri = s.yeniKayit * 1500;
    const bekleyenTaksitPayi = bekleyenTaksit * (s.tahsilat / 100);
    const beklenenGelir = Math.round(tahsilatKatsayili + yeniKayitGeliri + bekleyenTaksitPayi);
    const beklenenGider = Math.round(gider / months);
    return {
      s,
      net: beklenenGelir - beklenenGider,
      beklenenGelir,
      beklenenGider,
      formula: { gecmisOrtGelir, tahsilatKatsayili, yeniKayitGeliri, bekleyenTaksitPayi },
    };
  });
  const maxNet = Math.max(...scenarioNets.map((r) => Math.abs(r.net)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
        Geçmiş tahsilat eğilimi, yeni kayıt varsayımı ve gerçek bekleyen taksit tutarlarına göre önümüzdeki ay için üç
        senaryo — tümü açıkça belirtilen varsayımlara dayanan bir <b>tahmindir</b>, kesin sonuç değildir.
      </p>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Kayıttan Gelen Bekleyen Taksit Geliri</h3>
          <span className="hint">Tüm senaryolara dahil edilir</span>
        </div>
        <p className="stat-value" style={{ margin: 0 }}>{tl(bekleyenTaksit)}</p>
      </div>

      <div className="grid cols-3">
        {scenarioNets.map(({ s, net, beklenenGelir, beklenenGider, formula }) => (
          <div key={s.key} className={`card stat-card tone-${s.tone}`}>
            <p className="stat-label">{s.label} Senaryo</p>
            <p className="stat-value">{tl(net)}</p>
            <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Beklenen net kâr</p>
            <div style={{ marginTop: 12, fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.6 }}>
              <div>Tahsilat oranı varsayımı: <b>%{s.tahsilat}</b></div>
              <div>Yeni kayıt varsayımı: <b>{s.yeniKayit}</b></div>
              <p style={{ margin: "8px 0 0" }}>{s.aciklama}</p>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--ink-muted)" }}>Nasıl hesaplandı?</summary>
              <dl style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-2xs)", color: "var(--ink-muted)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <dt>Geçmiş ort. aylık gelir × (%{s.tahsilat}/%85)</dt>
                  <dd style={{ margin: 0 }}>{tl(formula.tahsilatKatsayili)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <dt>+ Yeni kayıt geliri ({s.yeniKayit} × ₺1.500)</dt>
                  <dd style={{ margin: 0 }}>{tl(formula.yeniKayitGeliri)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <dt>+ Bekleyen taksit payı (₺{Math.round(bekleyenTaksit).toLocaleString("tr-TR")} × %{s.tahsilat})</dt>
                  <dd style={{ margin: 0 }}>{tl(formula.bekleyenTaksitPayi)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 4, fontWeight: 700 }}>
                  <dt>= Beklenen gelir</dt>
                  <dd style={{ margin: 0 }}>{tl(beklenenGelir)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <dt>− Geçmiş ort. aylık gider</dt>
                  <dd style={{ margin: 0 }}>{tl(beklenenGider)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 4, fontWeight: 700, color: "var(--ink)" }}>
                  <dt>= Beklenen net kâr</dt>
                  <dd style={{ margin: 0 }}>{tl(net)}</dd>
                </div>
              </dl>
            </details>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Senaryo Karşılaştırması</h3>
          <span className="hint">Beklenen net kâr (₺)</span>
        </div>
        <HBarChart
          max={maxNet}
          rows={scenarioNets.map(({ s, net }) => ({ label: `${s.label} Senaryo`, value: Math.abs(net), valueLabel: tl(net), tone: net < 0 ? "critical" : s.tone === "accent" ? undefined : s.tone }))}
        />
      </div>
    </div>
  );
}
