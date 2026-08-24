"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { closeMedicalCase, createMedicalCase, createScreening, fetchMedicalCases, fetchScreenings, healthKeys } from "@/lib/api/health";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR"];
const SEVERITY_LABEL: Record<string, string> = { DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek" };
const SEVERITY_TONE: Record<string, string> = { DUSUK: "neutral", ORTA: "warning", YUKSEK: "danger" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

function HealthView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const casesQuery = useQuery({ queryKey: healthKeys.cases(), queryFn: fetchMedicalCases });
  const screeningsQuery = useQuery({ queryKey: healthKeys.screenings(), queryFn: fetchScreenings });

  const [patientName, setPatientName] = useState("");
  const [severity, setSeverity] = useState("DUSUK");
  const [description, setDescription] = useState("");
  const [caseError, setCaseError] = useState<string | null>(null);

  const [scrName, setScrName] = useState("");
  const [scrGrades, setScrGrades] = useState("");
  const [scrError, setScrError] = useState<string | null>(null);

  const caseMutation = useMutation({
    mutationFn: () => createMedicalCase({ patientName: patientName.trim(), severity, description: description.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: healthKeys.cases() }); setPatientName(""); setDescription(""); setCaseError(null); },
    onError: (err) => setCaseError(err instanceof ApiError ? err.message : "Vaka açılamadı."),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => closeMedicalCase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.cases() }),
  });
  const screeningMutation = useMutation({
    mutationFn: () => createScreening({ name: scrName.trim(), targetGrades: scrGrades.split(",").map((g) => g.trim()).filter(Boolean) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: healthKeys.screenings() }); setScrName(""); setScrGrades(""); setScrError(null); },
    onError: (err) => setScrError(err instanceof ApiError ? err.message : "Tarama eklenemedi."),
  });

  const cases = casesQuery.data?.cases ?? [];
  const screenings = screeningsQuery.data?.screenings ?? [];

  return (
    <div className="screen">
      <h1>Sağlık / Revir</h1>
      <p className="lede">Tıbbi vaka takibi ve sağlık tarama kampanyaları.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Vaka</h3></div>
        <form onSubmit={(e) => { e.preventDefault(); if (!patientName.trim()) { setCaseError("Hasta adı zorunludur."); return; } caseMutation.mutate(); }} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Hasta</label><input value={patientName} onChange={(e) => setPatientName(e.target.value)} /></div>
          <div className="field"><label>Ciddiyet</label><select value={severity} onChange={(e) => setSeverity(e.target.value)}>{Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {caseError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{caseError}</p>}
          <button type="submit" disabled={caseMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{caseMutation.isPending ? "Kaydediliyor…" : "Vaka Aç"}</button>
        </form>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Tıbbi Vakalar</h3><span className="hint">{cases.length}</span></div>
        {casesQuery.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : cases.length === 0 ? <div className="empty-state"><Icon name="heart" /><p>Vaka yok.</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cases.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "var(--text-sm)" }}>{c.patientName ?? "—"}</b>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{fmt(c.openedAt)}{c.description ? ` · ${c.description}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className={`chip ${SEVERITY_TONE[c.severity]}`}>{SEVERITY_LABEL[c.severity]}</span>
                    {c.status === "ACIK"
                      ? <button type="button" className="btn xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(c.id)}>Kapat</button>
                      : <span className="chip neutral">Kapalı</span>}
                  </div>
                </div>
              ))}
            </div>}
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Sağlık Taramaları</h3><span className="hint">{screenings.length}</span></div>
        <form onSubmit={(e) => { e.preventDefault(); if (!scrName.trim()) { setScrError("Tarama adı zorunludur."); return; } screeningMutation.mutate(); }} className="grid cols-2" style={{ rowGap: 12, marginBottom: 12 }}>
          <div className="field"><label>Tarama Adı</label><input value={scrName} onChange={(e) => setScrName(e.target.value)} placeholder="Örn. Diş taraması" /></div>
          <div className="field"><label>Hedef Sınıflar (virgülle)</label><input value={scrGrades} onChange={(e) => setScrGrades(e.target.value)} placeholder="01, 02" /></div>
          {scrError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{scrError}</p>}
          <button type="submit" disabled={screeningMutation.isPending} className="btn sm" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{screeningMutation.isPending ? "Ekleniyor…" : "Tarama Ekle"}</button>
        </form>
        {screenings.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{screenings.map((s) => <span key={s.id} className="chip neutral">{s.name}{s.targetGrades.length ? ` · ${s.targetGrades.join(", ")}` : ""}</span>)}</div>}
      </div>
    </div>
  );
}

export function HealthDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok (sağlık verisi kısıtlı).</p></div>;
  return <HealthView me={me} />;
}
