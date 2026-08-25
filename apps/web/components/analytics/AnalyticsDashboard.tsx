"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { analyticsKeys, fetchAnalytics } from "@/lib/api/analytics";
import { Icon } from "@/components/ui/icons";

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

export function AnalyticsDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);

  const isSuperadmin = me?.role === "SUPERADMIN";
  const q = useQuery({ queryKey: analyticsKeys.global(), queryFn: fetchAnalytics, enabled: !!isSuperadmin });

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!isSuperadmin) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Global Analytics yalnızca Genel Merkez&apos;e açıktır.</p>
      </div>
    );
  }

  const d = q.data;
  const maxRevenue = Math.max(1, ...(d?.branchRevenue ?? []).map((b) => b.totalGelir));

  return (
    <div className="screen">
      <h1>Global Analytics</h1>
      <p className="lede">Tüm şubelerin konsolide akademik ve mali performansı — gerçek sınav ve muhasebe verisinden.</p>

      {q.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : !d ? null : (
        <>
          <div className="grid cols-3" style={{ marginBottom: 14 }}>
            <div className="card stat-card"><p className="stat-label">Şube Sayısı</p><p className="stat-value">{d.totalBranches}</p></div>
            <div className="card stat-card"><p className="stat-label">Toplam Öğrenci</p><p className="stat-value">{d.totalStudents}</p></div>
            <div className="card stat-card"><p className="stat-label">Kurum Ort. Net</p><p className="stat-value">{d.orgAvgNet != null ? d.orgAvgNet.toFixed(1) : "—"}</p></div>
          </div>

          <div className="grid cols-2" style={{ marginBottom: 14 }}>
            <div className="card card-pad">
              <div className="card-head"><h3>En Başarılı Şubeler</h3><span className="hint">Ort. Net</span></div>
              {d.topBranches.length === 0 ? (
                <div className="empty-state"><Icon name="chart" /><p>Henüz sınav verisi yok.</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.topBranches.map((b, i) => (
                    <div key={b.tenantId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "7px 0" }}>
                      <span style={{ fontSize: "var(--text-sm)" }}><b>{i + 1}. {b.tenantName}</b> <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>{b.city ?? ""} · {b.studentCount} sonuç</span></span>
                      <span className="chip strong">{b.avgNet != null ? b.avgNet.toFixed(1) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card card-pad">
              <div className="card-head"><h3>Ders Bazlı Ortalama Başarı</h3><span className="hint">%</span></div>
              {d.subjectPerformance.length === 0 ? (
                <div className="empty-state"><Icon name="chart" /><p>Henüz kazanım verisi yok.</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.subjectPerformance.map((s) => (
                    <div key={s.subject}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{s.subject}</span>
                        <span style={{ color: "var(--ink-faint)" }}>%{s.avgMasteryPct} · {s.count}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                        <div style={{ width: `${s.avgMasteryPct}%`, height: "100%", background: "var(--brand, #1667d6)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><h3>Şube Bazlı Gelir</h3><span className="hint">Muhasebe defterinden</span></div>
            {d.branchRevenue.length === 0 ? (
              <div className="empty-state"><Icon name="ledger" /><p>Henüz gelir kaydı yok.</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.branchRevenue.map((b) => (
                  <div key={b.tenantId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }}>{b.tenantName} <span style={{ color: "var(--ink-faint)" }}>{b.city ?? ""}</span></span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTl(b.totalGelir)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((b.totalGelir / maxRevenue) * 100)}%`, height: "100%", background: "var(--strong, #1f7d54)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
