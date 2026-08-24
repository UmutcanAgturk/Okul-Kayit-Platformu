"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createEvent, eventKeys, fetchEvents } from "@/lib/api/events";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EventsView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: eventKeys.branchList(), queryFn: fetchEvents });

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createEvent({ title: title.trim(), eventType: eventType.trim() || undefined, location: location.trim() || undefined, startAt: new Date(startAt).toISOString(), description: description.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: eventKeys.branchList() }); setTitle(""); setEventType(""); setLocation(""); setStartAt(""); setDescription(""); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Etkinlik oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Etkinlik başlığı zorunludur."); return; }
    if (!startAt) { setFormError("Başlangıç tarihi zorunludur."); return; }
    createMutation.mutate();
  }

  const events = q.data?.events ?? [];

  return (
    <div className="screen">
      <h1>Sosyal Etkinlik</h1>
      <p className="lede">Gezi, tören ve etkinlik yönetimi.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Etkinlik</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Başlık</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Bahar Şenliği" /></div>
          <div className="field"><label>Tür</label><input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Gezi / Tören" /></div>
          <div className="field"><label>Başlangıç</label><input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div className="field"><label>Konum</label><input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{createMutation.isPending ? "Oluşturuluyor…" : "Etkinliği Oluştur"}</button>
        </form>
      </div>

      <div className="grid cols-2">
        {q.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!q.isLoading && events.length === 0 && <div className="empty-state"><Icon name="star" /><p>Henüz etkinlik yok.</p></div>}
        {events.map((ev) => (
          <div key={ev.id} className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{ev.title}</h3>
              <span className="chip neutral">{ev.participantCount} katılım</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{fmt(ev.startAt)}{ev.eventType ? ` · ${ev.eventType}` : ""}</p>
            {ev.location && <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Konum: {ev.location}</p>}
            {ev.description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{ev.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventsDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <EventsView me={me} />;
}
