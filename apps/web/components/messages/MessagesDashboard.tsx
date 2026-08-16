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
  fetchInbox,
  fetchSentMessages,
  fetchTemplates,
  markMessageRead,
  messageKeys,
  sendMessage,
  updateTemplate,
  type MessageAudience,
  type MessageTemplate,
  type MessageTemplateKind,
} from "@/lib/api/messages";
import { Icon } from "@/components/ui/icons";

const SENDER_ROLES = ["BRANCH_ADMIN", "TEACHER"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const classroomsQuery = useQuery({ queryKey: messageKeys.classrooms(), queryFn: fetchClassroomsForMessaging });
  const classroomFilterable = audience === "ALL_STUDENTS" || audience === "ALL_GUARDIANS";

  useEffect(() => {
    if (appliedTemplate) {
      setTitle(appliedTemplate.title);
      setBody(appliedTemplate.body);
    }
  }, [appliedTemplate]);

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
      });
      setStatus(`Mesaj ${result.message.recipientCount} kişiye gönderildi.`);
      setTitle("");
      setBody("");
      setClassroomId("");
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
            }}
          >
            <option value="ALL_GUARDIANS">Tüm Veliler</option>
            <option value="ALL_STUDENTS">Tüm Öğrenciler</option>
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
      <div className="field" style={{ marginTop: 12 }}>
        <label>Başlık</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Veli Toplantısı Daveti" />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Mesaj</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Mesaj içeriği…" />
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
  const sentQuery = useQuery({ queryKey: messageKeys.sent(), queryFn: fetchSentMessages });
  const messages = sentQuery.data?.messages ?? [];
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
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {m.senderLabel} · {m.audienceLabel}
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

  const canSend = SENDER_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);

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
