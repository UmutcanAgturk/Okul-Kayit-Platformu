"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { calendarKeys, createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents } from "@/lib/api/calendar";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import type { MeResponse } from "@/lib/api/auth";

const WRITE_ROLES = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR"];

function formatDate(iso: string, allDay: boolean) {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

function CalendarView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const eventsQuery = useQuery({ queryKey: calendarKeys.branchList(), queryFn: fetchCalendarEvents });

  const canWrite = WRITE_ROLES.includes(me.role);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createCalendarEvent({
        title,
        eventType: eventType.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        allDay,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.branchList() });
      setTitle("");
      setEventType("");
      setLocation("");
      setDescription("");
      setStartAt("");
      setEndAt("");
      setAllDay(false);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Etkinlik oluşturulamadı."),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteCalendarEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKeys.branchList() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Etkinlik başlığı zorunludur.");
      return;
    }
    if (!startAt) {
      setFormError("Başlangıç tarihi zorunludur.");
      return;
    }
    createMutation.mutate();
  }

  const events = eventsQuery.data?.events ?? [];

  return (
    <div className="screen">
      <h1>Takvim / Etkinlikler</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {canWrite && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>Yeni Etkinlik</h3>
          </div>
          <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
            <div className="field">
              <label>Başlık</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Veli Toplantısı" />
            </div>
            <div className="field">
              <label>Etkinlik Türü (opsiyonel)</label>
              <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Örn. Toplantı, Tatil" />
            </div>
            <div className="field">
              <label>Başlangıç</label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Bitiş (opsiyonel)</label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Konum (opsiyonel)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Örn. Konferans Salonu" />
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ width: "auto" }} />
                Tüm gün
              </label>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Açıklama (opsiyonel)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa açıklama" />
            </div>
            {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn primary"
              style={{ gridColumn: "1 / -1", justifyContent: "center" }}
            >
              {createMutation.isPending ? "Oluşturuluyor…" : "Etkinliği Oluştur"}
            </button>
          </form>
        </div>
      )}

      <div className="grid cols-2">
        {eventsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!eventsQuery.isLoading && events.length === 0 && (
          <div className="empty-state">
            <Icon name="calendar" />
            <p>Henüz etkinlik yok.</p>
          </div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{ev.title}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {ev.eventType && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{ev.eventType}</span>}
                {canWrite && (
                  <button
                    type="button"
                    className="btn xs danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`"${ev.title}" etkinliği silinsin mi?`)) deleteMutation.mutate(ev.id);
                    }}
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              {formatDate(ev.startAt, ev.allDay)}
              {ev.endAt ? ` → ${formatDate(ev.endAt, ev.allDay)}` : ""}
            </p>
            {ev.location && (
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Konum: {ev.location}</p>
            )}
            {ev.description && (
              <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{ev.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Takvim / Etkinlikler — okul takviminin gerçek karşılığı. `CalendarEvent`
 * yalnızca düz `tenant_isolation` taşır (bkz. prisma/schema.prisma) — Servis
 * ile aynı desen. Takvim TÜM roller tarafından görüntülenebilir; etkinlik
 * oluşturma yetkisi API tarafında BRANCH_ADMIN / GUIDANCE_COORDINATOR /
 * (şube olarak yöneten SUPERADMIN) ile sınırlıdır.
 */
export function CalendarDashboard() {
  const router = useRouter();

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

  return <CalendarView me={me} />;
}
