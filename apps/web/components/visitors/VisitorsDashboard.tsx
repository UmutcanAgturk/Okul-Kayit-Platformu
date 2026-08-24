"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { checkoutVisitor, createVisitor, fetchVisitors, visitorKeys } from "@/lib/api/visitors";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN"];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function VisitorsView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: visitorKeys.branchList(), queryFn: fetchVisitors });

  const [visitorName, setVisitorName] = useState("");
  const [reason, setReason] = useState("");
  const [hostName, setHostName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createVisitor({ visitorName: visitorName.trim(), reason: reason.trim() || undefined, hostName: hostName.trim() || undefined, phone: phone.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.branchList() });
      setVisitorName(""); setReason(""); setHostName(""); setPhone(""); setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Ziyaretçi kaydı eklenemedi."),
  });

  const checkoutMutation = useMutation({
    mutationFn: (id: string) => checkoutVisitor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: visitorKeys.branchList() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!visitorName.trim()) { setFormError("Ziyaretçi adı zorunludur."); return; }
    createMutation.mutate();
  }

  const visitors = q.data?.visitors ?? [];

  return (
    <div className="screen">
      <h1>Ziyaretçi Yönetimi</h1>
      <p className="lede">Okul girişinde ziyaretçi giriş/çıkış kaydı.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Ziyaretçi Girişi</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Ziyaretçi Adı</label><input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} /></div>
          <div className="field"><label>Ziyaret Sebebi</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. Veli görüşmesi" /></div>
          <div className="field"><label>Görüşülen Kişi</label><input value={hostName} onChange={(e) => setHostName(e.target.value)} /></div>
          <div className="field"><label>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
            {createMutation.isPending ? "Kaydediliyor…" : "Girişi Kaydet"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Ziyaret Kayıtları</h3><span className="hint">Son {visitors.length}</span></div>
        {q.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : visitors.length === 0 ? (
          <div className="empty-state"><Icon name="users" /><p>Henüz ziyaretçi kaydı yok.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ziyaretçi</th><th>Sebep</th><th>Görüşülen</th><th>Giriş</th><th>Çıkış</th><th></th></tr></thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.visitorName}</td>
                    <td>{v.reason ?? "—"}</td>
                    <td>{v.hostName ?? "—"}</td>
                    <td>{fmt(v.checkInAt)}</td>
                    <td>{v.checkOutAt ? fmt(v.checkOutAt) : <span style={{ color: "var(--weak)" }}>İçeride</span>}</td>
                    <td>{!v.checkOutAt && (
                      <button type="button" className="btn xs" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate(v.id)}>Çıkış Ver</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function VisitorsDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <VisitorsView me={me} />;
}
