"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { assignmentKeys, createAssignment, fetchAssignments, fetchAssignmentSubmissions, fetchSubmissionFile, gradeSubmission, type SubmissionRow } from "@/lib/api/assignments";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];

const STATUS_CHIP: Record<string, string> = { ASSIGNED: "chip", SUBMITTED: "chip weak", GRADED: "chip strong" };
const STATUS_LABEL: Record<string, string> = { ASSIGNED: "Teslim edilmedi", SUBMITTED: "Teslim edildi", GRADED: "Değerlendirildi" };

function GradeRow({ assignmentId, row }: { assignmentId: string; row: SubmissionRow }) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState(row.grade ?? "");
  const [feedback, setFeedback] = useState(row.feedback ?? "");
  const [open, setOpen] = useState(false);
  const gradeMut = useMutation({
    mutationFn: () => gradeSubmission(assignmentId, row.submissionId!, { grade: grade.trim(), feedback: feedback.trim() || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentKeys.submissions(assignmentId) }),
  });
  async function viewFile() {
    const f = await fetchSubmissionFile(assignmentId, row.submissionId!);
    if (f.dataUrl) window.open(f.dataUrl, "_blank");
  }
  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span><b>{row.studentName}</b></span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {row.grade && <span className="chip strong">Not: {row.grade}</span>}
          <span className={STATUS_CHIP[row.status]} style={{ fontSize: "var(--text-xs)" }}>{STATUS_LABEL[row.status]}</span>
          {row.submissionId && <button type="button" className="btn xs" onClick={() => setOpen((v) => !v)}>{open ? "Kapat" : "Değerlendir"}</button>}
        </span>
      </div>
      {open && row.submissionId && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {row.note && <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>Öğrenci notu: {row.note}</p>}
          {row.hasFile && <button type="button" className="btn xs" onClick={viewFile}>📎 {row.fileName ?? "Dosyayı Gör"}</button>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ maxWidth: 120 }}><label>Not</label><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="85 / AA" /></div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Geri Bildirim</label><input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Opsiyonel" /></div>
            <button type="button" className="btn primary sm" disabled={!grade.trim() || gradeMut.isPending} onClick={() => gradeMut.mutate()}>{gradeMut.isPending ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionsPanel({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const q = useQuery({ queryKey: assignmentKeys.submissions(assignmentId), queryFn: () => fetchAssignmentSubmissions(assignmentId) });
  if (q.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  const d = q.data;
  if (!d) return null;
  return (
    <div>
      <button type="button" className="btn ghost sm" onClick={onBack} style={{ marginBottom: 10 }}>‹ Ödevler</button>
      <h2 style={{ margin: "0 0 4px" }}>{d.assignment.title}</h2>
      <p className="lede" style={{ marginTop: 0 }}>{d.submittedCount}/{d.total} teslim · {d.gradedCount} değerlendirildi</p>
      <div className="card card-pad">
        {d.rows.map((r) => <GradeRow key={r.studentId} assignmentId={assignmentId} row={r} />)}
      </div>
    </div>
  );
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function AssignmentsView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: assignmentKeys.branchList(), queryFn: fetchAssignments });
  const [selected, setSelected] = useState<string | null>(null);

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
      <p className="lede">Ödev verme, teslim takibi ve değerlendirme.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {selected ? <SubmissionsPanel assignmentId={selected} onBack={() => setSelected(null)} /> : (
      <>
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
            <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={() => setSelected(a.id)}>Teslimler & Değerlendir</button>
          </div>
        ))}
      </div>
      </>
      )}
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
