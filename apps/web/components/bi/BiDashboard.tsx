"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { biKeys, fetchBiDashboard } from "@/lib/api/bi";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "ACCOUNTING", "SUPERADMIN"];

function tl(n: number) { return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`; }

function Bar({ pct, color = "var(--brand, #1667d6)" }: { pct: number; color?: string }) {
  return <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }} /></div>;
}

export function BiDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);

  const allowed = me ? ALLOWED.includes(me.role) : false;
  const q = useQuery({ queryKey: biKeys.dashboard(), queryFn: fetchBiDashboard, enabled: allowed });

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!allowed) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Yönetim Paneli yalnızca yönetim rollerine açıktır.</p></div>;

  const d = q.data;
  const maxRev = Math.max(1, ...(d?.finance.trend ?? []).flatMap((t) => [t.revenue, t.expense]));

  return (
    <div className="screen">
      <h1>Yönetim Paneli</h1>
      <p className="lede">Şube performansının tek ekranda özeti — doluluk, tahsilat, ciro, akademik ve personel.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {q.isLoading || !d ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : (
        <>
          {/* KPI kartları */}
          <div className="grid cols-4" style={{ marginBottom: 14 }}>
            <div className="card stat-card"><p className="stat-label">Aktif Öğrenci</p><p className="stat-value">{d.students.total}</p><p className="stat-sub">{d.students.unassigned} sınıfsız</p></div>
            <div className="card stat-card"><p className="stat-label">Doluluk</p><p className="stat-value">%{d.occupancy.pct}</p><p className="stat-sub">{d.occupancy.enrolled}/{d.occupancy.capacity}</p></div>
            <div className="card stat-card tone-strong"><p className="stat-label">Tahsilat Oranı</p><p className="stat-value">%{d.collection.rate}</p><p className="stat-sub">Geciken {tl(d.collection.overdueAmount)}</p></div>
            <div className="card stat-card tone-accent"><p className="stat-label">Bu Ay Net</p><p className="stat-value" style={{ fontSize: "var(--text-lg)" }}>{tl(d.finance.netThisMonth)}</p><p className="stat-sub">Ciro {tl(d.finance.revenueThisMonth)}</p></div>
          </div>

          <div className="grid cols-2" style={{ gap: 14, alignItems: "start" }}>
            {/* Ciro/gider trendi */}
            <div className="card card-pad">
              <div className="card-head"><h3>Gelir / Gider (Son 6 Ay)</h3></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.finance.trend.map((t, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{t.label}</span><span style={{ color: "var(--ink-faint)" }}>Net {tl(t.net)}</span></div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <div style={{ flex: 1 }}><Bar pct={(t.revenue / maxRev) * 100} color="var(--strong, #1f7d54)" /></div>
                      <div style={{ flex: 1 }}><Bar pct={(t.expense / maxRev) * 100} color="var(--critical)" /></div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 12, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}><span>■ Gelir</span><span style={{ color: "var(--critical)" }}>■ Gider</span></div>
              </div>
            </div>

            {/* Tahsilat kırılımı */}
            <div className="card card-pad">
              <div className="card-head"><h3>Tahsilat Durumu</h3></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "var(--text-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "5px 0" }}><span>Tahsil edilen</span><b style={{ color: "var(--strong)" }}>{tl(d.collection.collectedAmount)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "5px 0" }}><span>Bekleyen</span><b>{tl(d.collection.outstandingAmount)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Vadesi geçen</span><b style={{ color: "var(--critical)" }}>{tl(d.collection.overdueAmount)}</b></div>
                <Bar pct={d.collection.rate} color="var(--strong, #1f7d54)" />
                <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Tahsilat oranı %{d.collection.rate}</p>
              </div>
            </div>

            {/* Akademik */}
            <div className="card card-pad">
              <div className="card-head"><h3>Akademik Başarı</h3><span className="hint">Ort. Net {d.academic.avgNet ?? "—"}</span></div>
              {d.academic.subjectPerformance.length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz kazanım verisi yok.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.academic.subjectPerformance.map((s) => (
                    <div key={s.subject}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{s.subject}</span><span style={{ color: "var(--ink-faint)" }}>%{s.pct}</span></div>
                      <Bar pct={s.pct} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Personel */}
            <div className="card card-pad">
              <div className="card-head"><h3>Kadro</h3></div>
              <div className="grid cols-2">
                <div className="card stat-card"><p className="stat-label">Öğretmen</p><p className="stat-value">{d.staff.teacherCount}</p></div>
                <div className="card stat-card"><p className="stat-label">Diğer Personel</p><p className="stat-value">{d.staff.staffCount}</p></div>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Sınav sonucu sayısı: {d.academic.examResultCount}</p>
            </div>
          </div>

          <button type="button" className="btn sm" style={{ marginTop: 14 }} onClick={() => window.print()}>🖨️ Yazdır / PDF</button>
        </>
      )}
    </div>
  );
}
