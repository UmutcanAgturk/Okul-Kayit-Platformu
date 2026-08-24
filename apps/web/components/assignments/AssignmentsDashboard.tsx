"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { assignmentKeys, createAssignment, fetchAssignments } from "@/lib/api/assignments";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function AssignmentsView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: assignmentKeys.branchList(), queryFn: fetchAssignments });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createAssignment({ title: title.trim(), description: description.trim() || undefined, startDate: startDate ? new Date(startDate).toISOString() : undefined, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: assignmentKeys.branchList() }); setTitle(""); setDescription(""); setStartDate(""); setDueDate(""); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Ödev oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Ödev başlığı zorunludur."); return; }
    createMutation.mutate();
  }

  const assignments = q.data?.assignments ?? [];

  return (
    <div className="screen">
      <h1>Ödevler</h1>
      <p className="lede">Ödev verme ve tamamlanma takibi.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Ödev</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Başlık</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. 1. Ünite Testi" /></div>
          <div className="field"><label>Başlama</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="field"><label>Teslim Tarihi</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa açıklama" /></div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{createMutation.isPending ? "Oluşturuluyor…" : "Ödevi Oluştur"}</button>
        </form>
      </div>

      <div className="grid cols-2">
        {q.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!q.isLoading && assignments.length === 0 && <div className="empty-state"><Icon name="book" /><p>Henüz ödev yok.</p></div>}
        {assignments.map((a) => (
          <div key={a.id} className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{a.title}</h3>
              <span className="chip neutral">{a.submissionCount} teslim</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Başlama: {fmt(a.startDate)} · Teslim: {fmt(a.dueDate)}</p>
            {a.description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{a.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignmentsDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <AssignmentsView me={me} />;
}
