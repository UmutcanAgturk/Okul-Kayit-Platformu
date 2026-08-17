"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHqAccountingLedgerDetail, fetchHqAccountingSummary, hqKeys } from "@/lib/api/hq";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

const ENTRY_CATEGORY_LABEL: Record<string, string> = {};

/**
 * Muhasebe'nin HQ modunda demo'daki isConsolidated ("Tüm Şubeler") sekmesinin
 * karşılığı — tek bir şubenin defterini değil, /api/hq/accounting-ledger'ın
 * (zaten Kurumlar sayfasında kullanılan, bkz. components/hq/HqDashboard.tsx)
 * döndürdüğü TÜM şubelerin gelir/gider/net özetini gösterir. Bir kurum
 * satırına tıklayınca aynı endpoint'in ?tenantId= drill-down'ı ile o kurumun
 * tüm kayıt defteri satırları altta açılır.
 */
export function MuhasebeConsolidatedPanel() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const summaryQuery = useQuery({ queryKey: hqKeys.accountingSummary(), queryFn: fetchHqAccountingSummary });
  const detailQuery = useQuery({
    queryKey: hqKeys.accountingDetail(selectedTenantId ?? ""),
    queryFn: () => fetchHqAccountingLedgerDetail(selectedTenantId!),
    enabled: !!selectedTenantId,
  });

  const summary = summaryQuery.data;
  const detail = detailQuery.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Tüm Şubeler — Konsolide Mali Özet</h3>
        </div>
        {summaryQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {summary && (
          <>
            <div className="grid cols-3" style={{ marginBottom: 14 }}>
              <div className="card stat-card">
                <p className="stat-label">Toplam Gelir</p>
                <p className="stat-value">{tl(summary.grandTotal.totalGelir)}</p>
              </div>
              <div className="card stat-card">
                <p className="stat-label">Toplam Gider</p>
                <p className="stat-value">{tl(summary.grandTotal.totalGider)}</p>
              </div>
              <div className="card stat-card">
                <p className="stat-label">Genel Net</p>
                <p className="stat-value">{tl(summary.grandTotal.net)}</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Kurum</th>
                    <th style={{ textAlign: "right" }}>Kayıt</th>
                    <th style={{ textAlign: "right" }}>Gelir</th>
                    <th style={{ textAlign: "right" }}>Gider</th>
                    <th style={{ textAlign: "right" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.tenants.map((t) => (
                    <tr
                      key={t.tenantId}
                      onClick={() => setSelectedTenantId(t.tenantId === selectedTenantId ? null : t.tenantId)}
                      style={{ cursor: "pointer", background: t.tenantId === selectedTenantId ? "var(--surface-2)" : undefined }}
                    >
                      <td>{t.tenantName}</td>
                      <td style={{ textAlign: "right" }}>{t.entryCount}</td>
                      <td style={{ textAlign: "right" }}>{tl(t.totalGelir)}</td>
                      <td style={{ textAlign: "right" }}>{tl(t.totalGider)}</td>
                      <td style={{ textAlign: "right" }}>{tl(t.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Kayıt defterini görmek için bir kurum satırına tıklayın.</p>
          </>
        )}
      </div>

      {selectedTenantId && (
        <div className="card card-pad">
          <div className="card-head">
            <h3>{detail?.tenant.name ?? "Kayıt Defteri"}</h3>
          </div>
          {detailQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {detail && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Kategori</th>
                    <th>Not</th>
                    <th style={{ textAlign: "right" }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.entryDate).toLocaleDateString("tr-TR")}</td>
                      <td>{e.type === "GELIR" ? "Gelir" : "Gider"}</td>
                      <td>{ENTRY_CATEGORY_LABEL[e.category] ?? e.category}</td>
                      <td>{e.note ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{tl(Number(e.amount))}</td>
                    </tr>
                  ))}
                  {detail.entries.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--ink-muted)" }}>
                        Kayıt yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
