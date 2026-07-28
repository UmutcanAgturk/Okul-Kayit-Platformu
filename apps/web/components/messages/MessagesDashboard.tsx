"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  deleteInboxMessage,
  fetchClassroomsForMessaging,
  fetchInbox,
  fetchSentMessages,
  markMessageRead,
  messageKeys,
  sendMessage,
  type MessageAudience,
} from "@/lib/api/messages";

const SENDER_ROLES = ["BRANCH_ADMIN", "TEACHER"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function ComposeForm({ canTargetStaff }: { canTargetStaff: boolean }) {
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
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Mesaj Gönder</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Hedef Kitle</label>
          <select
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as MessageAudience);
              setClassroomId("");
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="ALL_GUARDIANS">Tüm Veliler</option>
            <option value="ALL_STUDENTS">Tüm Öğrenciler</option>
            {canTargetStaff && <option value="ALL_TEACHERS">Tüm Öğretmenler</option>}
            {canTargetStaff && <option value="ALL_STAFF">Tüm Personel</option>}
          </select>
        </div>
        {classroomFilterable && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Sınıf (opsiyonel filtre)</label>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
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
      <div className="mt-3">
        <label className="text-xs text-slate-500 dark:text-slate-400">Başlık</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Örn. Veli Toplantısı Daveti"
        />
      </div>
      <div className="mt-3">
        <label className="text-xs text-slate-500 dark:text-slate-400">Mesaj</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Mesaj içeriği…"
        />
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      {status && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{status}</p>}
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="mt-3 rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-50"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
    </div>
  );
}

function SentList() {
  const sentQuery = useQuery({ queryKey: messageKeys.sent(), queryFn: fetchSentMessages });
  const messages = sentQuery.data?.messages ?? [];
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Gönderilen Mesajlar</h2>
      {sentQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
      {!sentQuery.isLoading && messages.length === 0 && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz mesaj göndermediniz.</p>
      )}
      <div className="mt-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-slate-50">{m.title}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{m.body}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
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
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Gelen Kutusu</h2>
        {(inboxQuery.data?.unreadCount ?? 0) > 0 && (
          <span className="rounded-full bg-[#0071ce] px-2 py-0.5 text-xs font-medium text-white">{inboxQuery.data?.unreadCount} yeni</span>
        )}
      </div>
      {inboxQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
      {!inboxQuery.isLoading && messages.length === 0 && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Gelen kutunuz boş.</p>
      )}
      <div className="mt-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            onClick={() => handleOpen(m.id, m.readAt)}
            className={`cursor-pointer rounded-lg border p-3 text-sm ${
              m.readAt ? "border-slate-100 dark:border-slate-800" : "border-[#0071ce] bg-blue-50 dark:bg-blue-950/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-slate-50">{m.title}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.body}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {m.senderLabel} · {m.audienceLabel}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(m.id);
                }}
                className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
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

/**
 * İletişim — demo/seviye360-app.html'deki "branch:iletisim"/"teacher:iletisim"/
 * "student:iletisim" ekranlarının gerçek karşılığı. SMS/e-posta kanalları ve
 * dosya ekleri demo'da yalnızca simülasyondur (bkz. app/api/branch/messages'daki
 * not) — bu sürüm yalnızca uygulama-içi mesajlaşmayı gerçek veriye bağlar.
 */
export function MessagesDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  const canSend = SENDER_ROLES.includes(me.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">İletişim</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Ana Sayfa
          </a>
          <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Çıkış Yap
          </button>
        </div>
      </div>

      {canSend && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ComposeForm canTargetStaff={me.role === "BRANCH_ADMIN"} />
          <SentList />
        </div>
      )}

      <Inbox />
    </div>
  );
}
