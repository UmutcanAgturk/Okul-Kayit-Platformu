"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { activateAcademicYear, academicKeys, fetchAcademicYears, fetchPromotionRuns, generateAcademicYears, runPromotion } from "@/lib/api/academic";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN"];
const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function AcademicView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const yearsQuery = useQuery({ queryKey: academicKeys.years(), queryFn: fetchAcademicYears });
  const runsQuery = useQuery({ queryKey: academicKeys.promotions(), queryFn: fetchPromotionRuns });
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoteArmed, setPromoteArmed] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => generateAcademicYears(),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: academicKeys.years() }); setBanner(`${r.created} yeni akademik yıl oluşturuldu (2050'ye kadar).`); setError(null); },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Yıllar oluşturulamadı."),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => activateAcademicYear(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: academicKeys.years() }),
  });
  const promoteMutation = useMutation({
    mutationFn: () => runPromotion(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: academicKeys.years() });
      queryClient.invalidateQueries({ queryKey: academicKeys.promotions() });
      setPromoteArmed(false);
      setBanner(`Dönem geçişi tamamlandı: ${r.run.fromYearLabel} → ${r.run.toYearLabel}. ${r.run.promotedCount} öğrenci yükseltildi, ${r.run.graduatedCount} mezun.`);
      setError(null);
    },
    onError: (err) => { setPromoteArmed(false); setError(err instanceof ApiError ? err.message : "Dönem geçişi yapılamadı."); },
  });

  const years = yearsQuery.data?.years ?? [];
  const runs = runsQuery.data?.runs ?? [];
  const activeYear = years.find((y) => y.active) ?? null;

  return (
    <div className="screen">
      <h1>Dönem Geçişleri</h1>
      <p className="lede">Akademik yıl yönetimi ve öğrenci sınıf geçişi (2050&apos;ye kadar).</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {banner && <div className="card card-pad" style={{ marginBottom: 12, borderColor: "var(--strong)", background: "var(--strong-bg)" }}><p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--strong)" }}>{banner}</p></div>}
      {error && <div className="card card-pad" style={{ marginBottom: 12 }}><p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--critical)" }}>{error}</p></div>}

      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="card stat-card"><p className="stat-label">Aktif Akademik Yıl</p><p className="stat-value">{activeYear?.label ?? "—"}</p></div>
        <div className="card stat-card"><p className="stat-label">Tanımlı Yıl</p><p className="stat-value">{years.length}</p></div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Akademik Yıllar</h3>
          <button type="button" className="btn sm" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? "Oluşturuluyor…" : "2050'ye Kadar Oluştur"}
          </button>
        </div>
        {yearsQuery.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : years.length === 0 ? <div className="empty-state"><Icon name="clock" /><p>Henüz akademik yıl yok. &quot;2050&apos;ye Kadar Oluştur&quot; ile başlayın.</p></div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {years.map((y) => (
                <div key={y.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: y.active ? "var(--strong-bg)" : "transparent" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "var(--text-sm)" }}>{y.label}</span>
                  {y.active ? <span className="chip success">Aktif</span> : (
                    <button type="button" className="btn xs" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate(y.id)}>Aktif Yap</button>
                  )}
                </div>
              ))}
            </div>}
      </div>

      <div className="card card-pad" style={{ marginBottom: 14, borderColor: "var(--critical)" }}>
        <div className="card-head"><h3>Sınıf Geçişi (Dönem Geçişi)</h3></div>
        <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          Aktif yıldaki <b>tüm öğrencileri bir üst sınıfa</b> taşır (12. sınıf → Mezun) ve bir sonraki yılı aktif yapar. Bu işlem geri alınamaz.
        </p>
        {!promoteArmed ? (
          <button type="button" className="btn danger" disabled={!activeYear} onClick={() => setPromoteArmed(true)}>Dönem Geçişini Başlat</button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>Emin misiniz? {activeYear?.label} → sonraki yıl.</span>
            <button type="button" className="btn danger solid" disabled={promoteMutation.isPending} onClick={() => promoteMutation.mutate()}>{promoteMutation.isPending ? "Uygulanıyor…" : "Evet, Geçişi Yap"}</button>
            <button type="button" className="btn sm" onClick={() => setPromoteArmed(false)}>Vazgeç</button>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Geçiş Geçmişi</h3><span className="hint">{runs.length}</span></div>
        {runsQuery.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : runs.length === 0 ? <div className="empty-state"><Icon name="clock" /><p>Henüz dönem geçişi yapılmadı.</p></div>
          : <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Tarih</th><th>Geçiş</th><th>Yükseltilen</th><th>Mezun</th></tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{fmt(r.runAt)}</td>
                      <td style={{ fontFamily: "monospace" }}>{r.fromYearLabel} → {r.toYearLabel}</td>
                      <td>{r.promotedCount}</td>
                      <td>{r.graduatedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  );
}

export function AcademicTransitionsDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <AcademicView me={me} />;
}
