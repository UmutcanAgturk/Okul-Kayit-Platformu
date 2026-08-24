"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createTask, fetchTasks, taskKeys, updateTaskStatus } from "@/lib/api/tasks";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR", "TEACHER", "ACCOUNTING"];
const PRIORITY_LABEL: Record<string, string> = { LOW: "Düşük", NORMAL: "Normal", HIGH: "Yüksek" };
const STATUS_LABEL: Record<string, string> = { OPEN: "Açık", IN_PROGRESS: "Devam Ediyor", DONE: "Tamamlandı", CANCELLED: "İptal" };
const STATUS_TONE: Record<string, string> = { OPEN: "neutral", IN_PROGRESS: "warning", DONE: "success", CANCELLED: "neutral" };

function TasksView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: taskKeys.branchList(), queryFn: fetchTasks });

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [dueDate, setDueDate] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createTask({ title: title.trim(), priority, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined, requiresApproval }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: taskKeys.branchList() }); setTitle(""); setDueDate(""); setRequiresApproval(false); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Görev oluşturulamadı."),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.branchList() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Görev başlığı zorunludur."); return; }
    createMutation.mutate();
  }

  const tasks = q.data?.tasks ?? [];

  return (
    <div className="screen">
      <h1>Görevler &amp; Onaylar</h1>
      <p className="lede">Kurumsal görev ve onay iş akışı.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Görev</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Başlık</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>Öncelik</label><select value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label>Vade</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} style={{ width: "auto" }} /> Onay gerektirir
            </label>
          </div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{createMutation.isPending ? "Oluşturuluyor…" : "Görevi Oluştur"}</button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Görevler</h3><span className="hint">{tasks.length}</span></div>
        {q.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : tasks.length === 0 ? <div className="empty-state"><Icon name="kanban" /><p>Henüz görev yok.</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "var(--text-sm)" }}>{t.title}</b>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      Öncelik: {PRIORITY_LABEL[t.priority]}{t.dueDate ? ` · Vade: ${new Date(t.dueDate).toLocaleDateString("tr-TR")}` : ""}{t.requiresApproval ? " · Onaylı" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className={`chip ${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    <select value={t.status} disabled={statusMutation.isPending} onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value })}>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

export function TasksDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <TasksView me={me} />;
}
