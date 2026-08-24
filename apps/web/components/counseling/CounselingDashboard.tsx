"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { closeCounselingCase, counselingKeys, createCounselingCase, fetchCounselingCases } from "@/lib/api/counseling";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR"];
const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

function CounselingView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: counselingKeys.branchList(), queryFn: fetchCounselingCases });

  const [subjectName, setSubjectName] = useState("");
  const [reason, setReason] = useState("");
  const [counselors, setCounselors] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createCounselingCase({ reason: reason.trim(), subjectName: subjectName.trim() || undefined, counselors: counselors.split(",").map((c) => c.trim()).filter(Boolean), description: description.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: counselingKeys.branchList() }); setSubjectName(""); setReason(""); setCounselors(""); setDescription(""); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Olay açılamadı."),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCounselingCase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: counselingKeys.branchList() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setFormError("Açılma nedeni zorunludur."); return; }
    createMutation.mutate();
  }

  const cases = q.data?.cases ?? [];

  return (
    <div className="screen">
      <h1>Rehberlik Olay Takibi</h1>
      <p className="lede">Rehberlik vaka/olay kaydı ve takibi.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Olay</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Görüşülen Kişi</label><input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Öğrenci / veli adı" /></div>
          <div className="field"><label>Danışmanlar (virgülle)</label><input value={counselors} onChange={(e) => setCounselors(e.target.value)} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açılma Nedeni</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. Akademik kaygı" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{createMutation.isPending ? "Kaydediliyor…" : "Olay Aç"}</button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Olaylar</h3><span className="hint">{cases.length}</span></div>
        {q.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : cases.length === 0 ? <div className="empty-state"><Icon name="flag" /><p>Olay kaydı yok.</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cases.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "var(--text-sm)" }}>{c.reason}</b>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.subjectName ? `${c.subjectName} · ` : ""}{fmt(c.openedAt)}{c.counselors.length ? ` · ${c.counselors.join(", ")}` : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {c.status === "ACIK"
                      ? <button type="button" className="btn xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(c.id)}>Kapat</button>
                      : <span className="chip neutral">Kapalı</span>}
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

export function CounselingDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <CounselingView me={me} />;
}
