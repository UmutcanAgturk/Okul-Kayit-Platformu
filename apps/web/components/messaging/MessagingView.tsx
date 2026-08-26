"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  conversationKeys,
  fetchConversation,
  fetchConversations,
  fetchStudentTeachers,
  sendConversationMessage,
  startConversation,
} from "@/lib/api/conversations";
import { Icon } from "@/components/ui/icons";

const ALLOWED = ["TEACHER", "PARENT"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface TeacherClasses { classrooms: { classroomName: string; students: { studentId: string; name: string }[] }[] }

export function MessagingView() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);

  const allowed = me ? ALLOWED.includes(me.role) : false;
  const list = useQuery({ queryKey: conversationKeys.list(), queryFn: fetchConversations, enabled: allowed, refetchInterval: 20000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!allowed) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Mesajlaşma yalnızca Öğretmen ve Veli rollerine açıktır.</p></div>;

  const conversations = list.data?.conversations ?? [];

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h1>Mesajlaşma</h1><p className="lede" style={{ marginTop: 0 }}>Veli–öğretmen birebir yazışma.</p></div>
        <button type="button" className="btn primary sm" onClick={() => setShowNew(true)}>+ Yeni Konuşma</button>
      </div>

      <div className="grid cols-2" style={{ gap: 14, alignItems: "start" }}>
        <div className="card card-pad">
          <div className="card-head"><h3>Konuşmalar</h3></div>
          {list.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : conversations.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz konuşma yok. &quot;Yeni Konuşma&quot; ile başlayın.</p>
          ) : conversations.map((c) => (
            <div key={c.id} onClick={() => setSelected(c.id)} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, background: selected === c.id ? "var(--surface-2)" : undefined }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <b>{c.otherName}</b>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.otherRole}</span>
                  {c.unread > 0 && <span className="chip strong" style={{ fontSize: 10 }}>{c.unread}</span>}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>{c.subject}{c.studentName ? ` · ${c.studentName}` : ""} — {c.lastMessage ?? ""}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--ink-faint)", flexShrink: 0 }}>{fmtTime(c.lastMessageAt)}</span>
            </div>
          ))}
        </div>

        <div>
          {selected ? <ThreadPanel conversationId={selected} onSent={() => { qc.invalidateQueries({ queryKey: conversationKeys.list() }); }} /> : (
            <div className="card card-pad"><p style={{ margin: 0, color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bir konuşma seçin.</p></div>
          )}
        </div>
      </div>

      {showNew && <NewConversationModal me={me} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); setSelected(id); qc.invalidateQueries({ queryKey: conversationKeys.list() }); }} />}
    </div>
  );
}

function ThreadPanel({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const qc = useQueryClient();
  const thread = useQuery({ queryKey: conversationKeys.thread(conversationId), queryFn: () => fetchConversation(conversationId), refetchInterval: 15000 });
  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: () => sendConversationMessage(conversationId, text.trim()),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: conversationKeys.thread(conversationId) }); onSent(); },
  });
  const d = thread.data;
  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", height: 460 }}>
      {!d ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : (
        <>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <div><h3 style={{ margin: 0 }}>{d.otherName}</h3><span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{d.subject}{d.studentName ? ` · ${d.studentName}` : ""}</span></div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
            {d.messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{ background: m.mine ? "var(--brand)" : "var(--surface-2)", color: m.mine ? "#fff" : "var(--ink)", padding: "7px 11px", borderRadius: 12, fontSize: "var(--text-sm)" }}>{m.body}</div>
                <div style={{ fontSize: 10, color: "var(--ink-faint)", textAlign: m.mine ? "right" : "left", marginTop: 2 }}>{fmtTime(m.createdAt)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yazın…" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) sendMut.mutate(); }} style={{ flex: 1 }} />
            <button type="button" className="btn primary" disabled={!text.trim() || sendMut.isPending} onClick={() => sendMut.mutate()}>Gönder</button>
          </div>
        </>
      )}
    </div>
  );
}

function NewConversationModal({ me, onClose, onCreated }: { me: { role: string; students?: { studentId: string; fullName: string }[] }; onClose: () => void; onCreated: (id: string) => void }) {
  const isParent = me.role === "PARENT";
  const [studentId, setStudentId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Veli: kendi çocukları + seçilen çocuğun öğretmenleri. Öğretmen: kendi sınıflarındaki öğrenciler.
  const teacherClasses = useQuery({ queryKey: ["teacher-classes"], queryFn: () => apiFetch<TeacherClasses>("/api/teacher/my-classes", { cache: "no-store" }), enabled: !isParent });
  const teachers = useQuery({ queryKey: ["student-teachers", studentId], queryFn: () => fetchStudentTeachers(studentId), enabled: isParent && !!studentId });

  const teacherStudents = (teacherClasses.data?.classrooms ?? []).flatMap((c) => c.students);
  const parentChildren = me.students ?? [];

  const createMut = useMutation({
    mutationFn: () => startConversation({ studentId, subject: subject.trim(), firstMessage: message.trim(), otherUserId: isParent ? teacherUserId : undefined }),
    onSuccess: (r) => onCreated(r.id),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Başlatılamadı"),
  });

  const baseOk = !!studentId && !!subject.trim() && !!message.trim();
  const canCreate = isParent ? baseOk && !!teacherUserId : baseOk;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ maxWidth: 460, width: "100%", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ margin: 0 }}>Yeni Konuşma</h3><button type="button" className="btn ghost sm" onClick={onClose}>Kapat</button></div>

        <div className="field"><label>{isParent ? "Çocuğunuz" : "Öğrenci"}</label>
          <select value={studentId} onChange={(e) => { setStudentId(e.target.value); setTeacherUserId(""); }}>
            <option value="">Seçin…</option>
            {isParent ? parentChildren.map((s) => <option key={s.studentId} value={s.studentId}>{s.fullName}</option>)
              : teacherStudents.map((s) => <option key={s.studentId} value={s.studentId}>{s.name}</option>)}
          </select>
        </div>

        {isParent && (
          <div className="field"><label>Öğretmen</label>
            <select value={teacherUserId} onChange={(e) => setTeacherUserId(e.target.value)} disabled={!studentId}>
              <option value="">{studentId ? "Seçin…" : "Önce çocuk seçin"}</option>
              {(teachers.data?.teachers ?? []).map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}
            </select>
            {isParent && studentId && (teachers.data?.teachers.length ?? 0) === 0 && !teachers.isLoading && <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Bu öğrenci için ders programında öğretmen bulunamadı.</p>}
          </div>
        )}

        <div className="field"><label>Konu</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Örn. Devamsızlık hakkında" /></div>
        <div className="field"><label>Mesaj</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Mesajınız…" /></div>
        {err && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{err}</p>}
        <button type="button" className="btn primary" disabled={!canCreate || createMut.isPending} onClick={() => createMut.mutate()}>{createMut.isPending ? "Başlatılıyor…" : "Konuşmayı Başlat"}</button>
      </div>
    </div>
  );
}
