"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createTemplate,
  deleteInboxMessage,
  deleteTemplate,
  fetchClassroomsForMessaging,
  fetchHqSentMessages,
  fetchInbox,
  fetchSentMessages,
  fetchTemplates,
  markMessageRead,
  messageKeys,
  recallMessage,
  searchMessageStudents,
  sendHqMessage,
  sendMessage,
  updateTemplate,
  type HqRecipientType,
  type MessageAttachmentRow,
  type MessageAudience,
  type MessageStudentSearchResult,
  type MessageTemplate,
  type MessageTemplateKind,
} from "@/lib/api/messages";
import { Icon } from "@/components/ui/icons";

const SENDER_ROLES = ["BRANCH_ADMIN", "TEACHER"];

// demo'daki accept=".pdf,image/*,audio/*" kapsamıyla aynı, PaymentReceipt'teki
// (bkz. app/api/students/[studentId]/payment-receipts) allowlist deseninin
// ses türlerine genişletilmiş hali — sunucudaki ACCEPTED_MIME_TYPES ile birebir.
const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];
const MAX_FILE_SIZE = 2_500_000;
const MAX_ATTACHMENTS = 5;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function attachmentKind(mimeType: string): "image" | "audio" | "pdf" | "dosya" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  return "dosya";
}

function AttachmentList({ attachments }: { attachments: MessageAttachmentRow[] }) {
  if (attachments.length === 0) return null;
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      {attachments.map((a) => {
        const kind = attachmentKind(a.mimeType);
        return (
          <div key={a.id} style={{ fontSize: "var(--text-xs)" }}>
            {kind === "image" ? (
              <a href={a.dataUrl} download={a.fileName} target="_blank" rel="noreferrer">
                <img src={a.dataUrl} alt={a.fileName} style={{ maxWidth: 220, maxHeight: 160, borderRadius: 6, display: "block" }} />
              </a>
            ) : kind === "audio" ? (
              <div>
                <div style={{ color: "var(--ink-faint)", marginBottom: 2 }}>{a.fileName}</div>
                <audio controls src={a.dataUrl} style={{ maxWidth: 260 }} />
              </div>
            ) : (
              <a href={a.dataUrl} download={a.fileName} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--brand)" }}>
                <Icon name="attach" /> {a.fileName}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * İletişim > Kime: tekil öğrenci seçimi (task #101) — demo'nun öğretmen
 * roster checkbox listesinin (renderIletisimComposeTeacher) karşılığı,
 * ancak arama tabanlı (bu depoda öğretmenin kendi roster'ı yok — bkz.
 * app/api/branch/messages/students-search yorumu). Seçim doluysa sınıf
 * bazlı toplu filtre sunucu tarafında göz ardı edilir.
 */
function StudentPicker({ selected, onChange }: { selected: MessageStudentSearchResult[]; onChange: (next: MessageStudentSearchResult[]) => void }) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 180);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const searchQuery = useQuery({
    queryKey: messageKeys.studentSearch(query),
    queryFn: () => searchMessageStudents(query),
    enabled: query.length >= 2,
  });
  const results = (searchQuery.data?.students ?? []).filter((s) => !selected.some((sel) => sel.id === s.id));

  return (
    <div className="field" style={{ marginTop: 12 }}>
      <label>Tekil Öğrenci Seç (opsiyonel — doluysa sınıf filtresi göz ardı edilir)</label>
      <input type="text" value={rawQuery} onChange={(e) => setRawQuery(e.target.value)} placeholder="İsim veya öğrenci no ile ara…" />
      {query.length >= 2 && results.length > 0 && (
        <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange([...selected, s]);
                setRawQuery("");
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 10px",
                fontSize: "var(--text-xs)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <b>{s.name}</b> · {s.studentNo}
              {s.classroomName && ` · ${s.classroomName}`}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map((s) => (
            <span key={s.id} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {s.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontWeight: 700, color: "var(--ink-faint)" }}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="btn xs" onClick={() => onChange([])}>
            Temizle
          </button>
        </div>
      )}
    </div>
  );
}

function ComposeForm({
  canTargetStaff,
  appliedTemplate,
}: {
  canTargetStaff: boolean;
  appliedTemplate: MessageTemplate | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<MessageAudience>("ALL_GUARDIANS");
  const [classroomId, setClassroomId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<MessageStudentSearchResult[]>([]);
  const [attachments, setAttachments] = useState<{ fileName: string; mimeType: string; dataUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError(null);
    for (const file of files) {
      if (attachments.length >= MAX_ATTACHMENTS) {
        setError(`En fazla ${MAX_ATTACHMENTS} dosya eklenebilir.`);
        break;
      }
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        setError(`"${file.name}" desteklenmeyen bir dosya türü.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" dosyası çok büyük (limit ~2,5MB).`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Dosya okunamadı."));
        reader.readAsDataURL(file);
      });
      setAttachments((prev) => [...prev, { fileName: file.name, mimeType: file.type, dataUrl }]);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const classroomsQuery = useQuery({ queryKey: messageKeys.classrooms(), queryFn: fetchClassroomsForMessaging });
  const templatesQuery = useQuery({ queryKey: messageKeys.templates(), queryFn: fetchTemplates });
  const templates = templatesQuery.data?.templates ?? [];
  const classroomFilterable = audience === "ALL_STUDENTS" || audience === "ALL_GUARDIANS" || audience === "STUDENTS_AND_GUARDIANS";

  useEffect(() => {
    if (appliedTemplate) {
      setTitle(appliedTemplate.title);
      setBody(appliedTemplate.body);
    }
  }, [appliedTemplate]);

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setTitle(t.title);
      setBody(t.body);
    }
  }

  async function handleSend() {
    setError(null);
    setStatus(null);
    if (!title.trim() || !body.trim()) {
      setError("Başlık ve mesaj metni zorunludur.");
      return;
    }
    setSending(true);
    try {
      const result = await sendMessage({
        title: title.trim(),
        body: body.trim(),
        audience,
        classroomId: classroomFilterable && classroomId ? classroomId : undefined,
        studentIds: classroomFilterable && selectedStudents.length > 0 ? selectedStudents.map((s) => s.id) : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setStatus(`Mesaj ${result.message.recipientCount} kişiye gönderildi.`);
      setTitle("");
      setBody("");
      setClassroomId("");
      setSelectedStudents([]);
      setAttachments([]);
      queryClient.invalidateQueries({ queryKey: messageKeys.sent() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Yeni Mesaj Gönder</h3>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label>Hedef Kitle</label>
          <select
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as MessageAudience);
              setClassroomId("");
              setSelectedStudents([]);
            }}
          >
            <option value="ALL_GUARDIANS">Tüm Veliler</option>
            <option value="ALL_STUDENTS">Tüm Öğrenciler</option>
            <option value="STUDENTS_AND_GUARDIANS">Öğrenci + Veli</option>
            {canTargetStaff && <option value="ALL_TEACHERS">Tüm Öğretmenler</option>}
            {canTargetStaff && <option value="ALL_STAFF">Tüm Personel</option>}
          </select>
        </div>
        {classroomFilterable && (
          <div className="field">
            <label>Sınıf (opsiyonel filtre)</label>
            <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">Tüm Sınıflar</option>
              {classroomsQuery.data?.classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount} öğrenci)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {classroomFilterable && <StudentPicker selected={selectedStudents} onChange={setSelectedStudents} />}
      <div className="field" style={{ marginTop: 12 }}>
        <label>Hazır Şablon Kullan (opsiyonel)</label>
        <select value="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
          <option value="">— Şablon seçin —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.kind === "bildirim" ? "🔔" : "✉️"} {t.category} · {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Başlık</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Veli Toplantısı Daveti" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Mesaj</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Mesaj içeriği…" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Ek Dosya (PDF, Görsel, Ses — opsiyonel)</label>
        <input type="file" accept=".pdf,image/*,audio/*" multiple onChange={handleFilesSelected} />
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {attachments.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                <span>{a.fileName}</span>
                <button type="button" className="btn xs" onClick={() => removeAttachment(i)}>
                  Kaldır
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      {status && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--strong)" }}>{status}</p>}
      <button type="button" onClick={handleSend} disabled={sending} className="btn primary" style={{ marginTop: 12 }}>
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
    </div>
  );
}

function SentList() {
  const queryClient = useQueryClient();
  const sentQuery = useQuery({ queryKey: messageKeys.sent(), queryFn: fetchSentMessages });
  const messages = sentQuery.data?.messages ?? [];
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleRecall(id: string) {
    setRecallingId(id);
    try {
      await recallMessage(id);
      queryClient.invalidateQueries({ queryKey: messageKeys.sent() });
    } finally {
      setRecallingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Gönderilen Mesajlar</h3>
      </div>
      {sentQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      {!sentQuery.isLoading && messages.length === 0 && (
        <div className="empty-state">
          <Icon name="send" />
          <p>Henüz mesaj göndermediniz.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {messages.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{m.title}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(m.createdAt)}</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{m.body}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              {m.audienceLabel} · {m.recipientCount} alıcı
              {m.attachments.length > 0 && (
                <>
                  {" · "}
                  <Icon name="attach" /> {m.attachments.length}
                </>
              )}
            </p>
            <AttachmentList attachments={m.attachments} />
            <div style={{ marginTop: 6 }}>
              {confirmId === m.id ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--critical)" }}>Bu mesaj tüm alıcılardan silinecek. Emin misiniz?</span>
                  <button type="button" className="btn xs danger" disabled={recallingId === m.id} onClick={() => handleRecall(m.id)}>
                    {recallingId === m.id ? "Geri çekiliyor…" : "Evet, Geri Çek"}
                  </button>
                  <button type="button" className="btn xs" onClick={() => setConfirmId(null)}>
                    Vazgeç
                  </button>
                </span>
              ) : (
                <button type="button" className="btn xs" onClick={() => setConfirmId(m.id)}>
                  Geri Çek
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const HQ_RECIPIENT_TYPE_DEFS: { id: HqRecipientType; label: string }[] = [
  { id: "STUDENTS", label: "Öğrenciler" },
  { id: "GUARDIANS", label: "Veliler" },
  { id: "TEACHERS", label: "Öğretmenler" },
  { id: "MANAGERS", label: "Şube Müdürleri" },
];

/**
 * İletişim — HQ Yayını (task #101) — bare SUPERADMIN için "Tüm Sistem (Tüm
 * Şubeler)" kapsamı + "Şube Müdürleri" alıcı türü (demo'daki isHq dalının
 * karşılığı, bkz. app/api/hq/messages/route.ts yorumu). Şube bazlı gönderim
 * zaten "Bu Şube Olarak Yönet" ile mevcut ComposeForm üzerinden yapılabildiği
 * için burada kapsam seçimi YOK — her zaman tüm sistem.
 */
function HqComposeForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [types, setTypes] = useState<Set<HqRecipientType>>(new Set(["STUDENTS", "GUARDIANS"]));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function toggleType(id: HqRecipientType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    setError(null);
    setStatus(null);
    if (!title.trim() || !body.trim()) {
      setError("Başlık ve mesaj metni zorunludur.");
      return;
    }
    if (types.size === 0) {
      setError("En az bir alıcı türü seçmelisiniz.");
      return;
    }
    setSending(true);
    try {
      const result = await sendHqMessage({ title: title.trim(), body: body.trim(), recipientTypes: Array.from(types) });
      setStatus(`Gönderildi — ${result.tenantsReached} şubedeki ${result.recipientCount} alıcıya ulaştı.`);
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: messageKeys.hqSent() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Yayın gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Genel Merkez Yayını</h3>
      </div>
      <p style={{ margin: "-6px 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Kapsam otomatik olarak <b>Tüm Sistem (Tüm Şubeler)</b> ile sınırlıdır. Tek bir şubeye göndermek için Kurum Yönetimi&apos;nden
        &quot;Bu Şube Olarak Yönet&quot; ile o şubeye geçebilirsiniz.
      </p>
      <div className="field">
        <label>Alıcı Türü</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {HQ_RECIPIENT_TYPE_DEFS.map((t) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "var(--text-sm)" }}>
              <input type="checkbox" checked={types.has(t.id)} onChange={() => toggleType(t.id)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Başlık</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Sistem Bakım Duyurusu" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Mesaj</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Mesaj içeriği…" />
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      {status && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--strong)" }}>{status}</p>}
      <button type="button" onClick={handleSend} disabled={sending} className="btn primary" style={{ marginTop: 12 }}>
        {sending ? "Gönderiliyor…" : "Tüm Sisteme Gönder"}
      </button>
    </div>
  );
}

function HqSentList() {
  const sentQuery = useQuery({ queryKey: messageKeys.hqSent(), queryFn: fetchHqSentMessages });
  const messages = sentQuery.data?.messages ?? [];

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Gönderilen Yayınlar</h3>
      </div>
      {sentQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      {!sentQuery.isLoading && messages.length === 0 && (
        <div className="empty-state">
          <Icon name="send" />
          <p>Henüz bir yayın göndermediniz.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 480, overflowY: "auto" }}>
        {messages.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{m.title}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(m.createdAt)}</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{m.body}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              {m.audienceLabel} · {m.recipientCount} alıcı
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Inbox() {
  const queryClient = useQueryClient();
  const inboxQuery = useQuery({ queryKey: messageKeys.inbox(), queryFn: fetchInbox });
  const messages = inboxQuery.data?.messages ?? [];

  async function handleOpen(id: string, readAt: string | null) {
    if (!readAt) {
      await markMessageRead(id);
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
    }
  }

  async function handleDelete(id: string) {
    await deleteInboxMessage(id);
    queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Gelen Kutusu</h3>
        {(inboxQuery.data?.unreadCount ?? 0) > 0 && <span className="chip strong">{inboxQuery.data?.unreadCount} yeni</span>}
      </div>
      {inboxQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      {!inboxQuery.isLoading && messages.length === 0 && (
        <div className="empty-state">
          <Icon name="inbox" />
          <p>Gelen kutunuz boş.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            onClick={() => handleOpen(m.id, m.readAt)}
            className="card"
            style={{
              cursor: "pointer",
              padding: "10px 14px",
              fontSize: "var(--text-base)",
              borderColor: m.readAt ? "var(--border)" : "var(--brand)",
              background: m.readAt ? "var(--surface)" : "var(--brand-tint)",
              boxShadow: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{m.title}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(m.createdAt)}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{m.body}</p>
            {m.readAt && <AttachmentList attachments={m.attachments} />}
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {m.senderLabel} · {m.audienceLabel}
                {m.attachments.length > 0 && (
                  <>
                    {" · "}
                    <Icon name="attach" /> {m.attachments.length}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(m.id);
                }}
                className="btn xs"
              >
                Kaldır
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const KIND_LABELS: Record<MessageTemplateKind, string> = { bildirim: "Bildirim", mesaj: "Mesaj" };

function TemplatesPanel({ onUse }: { onUse: (template: MessageTemplate) => void }) {
  const queryClient = useQueryClient();
  const templatesQuery = useQuery({ queryKey: messageKeys.templates(), queryFn: fetchTemplates });
  const templates = templatesQuery.data?.templates ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<MessageTemplateKind>("mesaj");
  const [category, setCategory] = useState("Genel");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setKind("mesaj");
    setCategory("Genel");
    setTitle("");
    setBody("");
  }

  function startEdit(template: MessageTemplate) {
    setEditingId(template.id);
    setKind(template.kind);
    setCategory(template.category);
    setTitle(template.title);
    setBody(template.body);
  }

  async function handleSave() {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Başlık ve içerik zorunludur.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTemplate(editingId, { kind, category: category.trim() || "Genel", title: title.trim(), body: body.trim() });
      } else {
        await createTemplate({ kind, category: category.trim() || "Genel", title: title.trim(), body: body.trim() });
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: messageKeys.templates() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Şablon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteTemplate(id);
    if (editingId === id) resetForm();
    queryClient.invalidateQueries({ queryKey: messageKeys.templates() });
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Hazır Şablonlar</h3>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label>Tür</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as MessageTemplateKind)}>
            <option value="mesaj">Mesaj</option>
            <option value="bildirim">Bildirim</option>
          </select>
        </div>
        <div className="field">
          <label>Kategori</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Örn. Ödeme, Etkinlik" />
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Başlık</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Şablon başlığı" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>İçerik</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Şablon metni…" />
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={handleSave} disabled={saving} className="btn primary">
          {saving ? "Kaydediliyor…" : editingId ? "Şablonu Güncelle" : "Şablon Ekle"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="btn">
            Vazgeç
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
        {!templatesQuery.isLoading && templates.length === 0 && (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>Henüz şablon eklemediniz.</p>
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{t.title}</span>
              <span className="chip">{KIND_LABELS[t.kind]}</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              {t.category} · {t.body}
            </p>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <button type="button" onClick={() => onUse(t)} className="btn xs primary">
                Kullan
              </button>
              <button type="button" onClick={() => startEdit(t)} className="btn xs">
                Düzenle
              </button>
              <button type="button" onClick={() => handleDelete(t.id)} className="btn xs">
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * İletişim — demo/seviye360-app.html'deki "branch:iletisim"/"teacher:iletisim"/
 * "student:iletisim" ekranlarının gerçek karşılığı. SMS/e-posta kanalları ve
 * dosya ekleri demo'da yalnızca simülasyondur (bkz. app/api/branch/messages'daki
 * not) — bu sürüm yalnızca uygulama-içi mesajlaşmayı gerçek veriye bağlar.
 */
export function MessagesDashboard() {
  const router = useRouter();
  const [appliedTemplate, setAppliedTemplate] = useState<MessageTemplate | null>(null);

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  const isHqBroadcast = me.role === "SUPERADMIN" && !me.actingTenantId;
  const canSend = SENDER_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);

  if (isHqBroadcast) {
    return (
      <div className="screen">
        <h1>İletişim — Genel Merkez</h1>
        <p className="lede">Tüm sistemdeki şubelere tek seferde duyuru/mesaj yayınlayın. Tek bir şubeye göndermek için Kurum Yönetimi&apos;nden o şubeye geçin.</p>
        <div style={{ marginBottom: 14 }}>
          <HqComposeForm />
        </div>
        <HqSentList />
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>İletişim</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {canSend && (
        <div className="grid cols-2" style={{ marginBottom: 14 }}>
          <ComposeForm
            canTargetStaff={me.role === "BRANCH_ADMIN" || (me.role === "SUPERADMIN" && !!me.actingTenantId)}
            appliedTemplate={appliedTemplate}
          />
          <TemplatesPanel onUse={(t) => setAppliedTemplate({ ...t })} />
        </div>
      )}

      {canSend && (
        <div style={{ marginBottom: 14 }}>
          <SentList />
        </div>
      )}

      <Inbox />
    </div>
  );
}
