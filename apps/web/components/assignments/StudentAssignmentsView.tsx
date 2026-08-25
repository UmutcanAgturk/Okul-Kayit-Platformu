"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { assignmentKeys, fetchStudentAssignments, submitAssignment, type StudentAssignment } from "@/lib/api/assignments";
import { Icon } from "@/components/ui/icons";

const ALLOWED = ["STUDENT", "PARENT"];

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
const STATUS_CHIP: Record<string, string> = { ASSIGNED: "chip", SUBMITTED: "chip weak", GRADED: "chip strong" };
const STATUS_LABEL: Record<string, string> = { ASSIGNED: "Bekliyor", SUBMITTED: "Teslim edildi", GRADED: "Değerlendirildi" };

function AssignmentCard({ studentId, a }: { studentId: string; a: StudentAssignment }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(a.note ?? "");
  const [file, setFile] = useState<{ fileName: string; mimeType: string; dataUrl: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitMut = useMutation({
    mutationFn: () => submitAssignment(studentId, a.id, { note: note.trim() || undefined, ...(file ?? {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: assignmentKeys.studentList(studentId) }); setOpen(false); setErr(null); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Teslim edilemedi"),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_500_000) { setErr("Dosya çok büyük (en fazla ~2.5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ fileName: f.name, mimeType: f.type, dataUrl: reader.result as string });
    reader.readAsDataURL(f);
  }

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{a.title}</h3>
        <span className={STATUS_CHIP[a.status]} style={{ fontSize: "var(--text-xs)" }}>{STATUS_LABEL[a.status]}</span>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Teslim: {fmt(a.dueDate)}</p>
      {a.description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{a.description}</p>}

      {a.status === "GRADED" && (
        <div className="card card-pad" style={{ marginTop: 10, background: "var(--strong-bg, var(--surface-2))" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Not: {a.grade}</p>
          {a.feedback && <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>Öğretmen: {a.feedback}</p>}
        </div>
      )}

      {a.status !== "GRADED" && (
        <div style={{ marginTop: 10 }}>
          {!open ? (
            <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>{a.status === "SUBMITTED" ? "Teslimi Güncelle" : "Teslim Et"}</button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="field"><label>Not / Açıklama</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Cevabınız veya açıklamanız" /></div>
              <div>
                <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>📎 Dosya Ekle</button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: "none" }} />
                {file && <span style={{ marginLeft: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{file.fileName}</span>}
              </div>
              {err && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{err}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn primary sm" disabled={submitMut.isPending || (!note.trim() && !file)} onClick={() => submitMut.mutate()}>{submitMut.isPending ? "Gönderiliyor…" : "Gönder"}</button>
                <button type="button" className="btn sm" onClick={() => setOpen(false)}>Vazgeç</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StudentAssignmentsView() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => { if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId); }, [students, selectedStudentId]);

  const q = useQuery({ queryKey: assignmentKeys.studentList(selectedStudentId ?? ""), queryFn: () => fetchStudentAssignments(selectedStudentId!), enabled: !!selectedStudentId });

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Ödevlerim yalnızca Öğrenci/Veli rolüne açıktır.</p></div>;
  if (students.length === 0) return <div className="card card-pad"><p style={{ margin: 0, fontSize: "var(--text-sm)" }}>{me.role === "STUDENT" ? "Öğrenci profiliniz bulunamadı." : "Velisi olduğunuz bir öğrenci bulunamadı."}</p></div>;

  const assignments = q.data?.assignments ?? [];
  return (
    <div className="screen">
      <h1>Ödevlerim</h1>
      <p className="lede">{me.firstName} {me.lastName}</p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(s.studentId)} className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}>{s.fullName}</button>
          ))}
        </div>
      )}

      {q.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : assignments.length === 0 ? (
        <div className="empty-state"><Icon name="book" /><p>Henüz ödev yok.</p></div>
      ) : (
        <div className="grid cols-2">
          {selectedStudentId && assignments.map((a) => <AssignmentCard key={a.id} studentId={selectedStudentId} a={a} />)}
        </div>
      )}
    </div>
  );
}
