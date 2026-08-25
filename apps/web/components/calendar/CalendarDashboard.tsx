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

// Görünürlük için sunulan hedef roller (yöneticiler zaten her etkinliği görür).
const AUDIENCE_ROLES: { value: string; label: string }[] = [
  { value: "TEACHER", label: "Öğretmen" },
  { value: "STUDENT", label: "Öğrenci" },
  { value: "PARENT", label: "Veli" },
  { value: "GUIDANCE_COORDINATOR", label: "Rehber" },
  { value: "ACCOUNTING", label: "Muhasebe" },
];
const ROLE_LABEL: Record<string, string> = Object.fromEntries(AUDIENCE_ROLES.map((r) => [r.value, r.label]));

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

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
  const [visibleRoles, setVisibleRoles] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });

  function toggleRole(r: string) {
    setVisibleRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

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
        visibleRoles,
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
      setVisibleRoles([]);
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

  // --- Aylık ızgara hesaplaması ---
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const eventsByDay = new Map<number, typeof events>();
  for (const ev of events) {
    const d = new Date(ev.startAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const arr = eventsByDay.get(d.getDate()) ?? [];
      arr.push(ev);
      eventsByDay.set(d.getDate(), arr);
    }
  }
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

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
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Kimler Görsün? {visibleRoles.length === 0 && <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>(seçilmezse herkes görür)</span>}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                {AUDIENCE_ROLES.map((r) => {
                  const on = visibleRoles.includes(r.value);
                  return (
                    <button key={r.value} type="button" onClick={() => toggleRole(r.value)} className={on ? "chip strong" : "chip"} style={{ cursor: "pointer", border: on ? undefined : "1px solid var(--border)" }}>
                      {on ? "✓ " : ""}{r.label}
                    </button>
                  );
                })}
              </div>
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

      {/* Görünüm geçişi */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" className={`btn sm ${view === "calendar" ? "primary" : ""}`} onClick={() => setView("calendar")}>Takvim</button>
        <button type="button" className={`btn sm ${view === "list" ? "primary" : ""}`} onClick={() => setView("list")}>Liste</button>
      </div>

      {eventsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {/* Aylık takvim ızgarası */}
      {!eventsQuery.isLoading && view === "calendar" && (
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" className="btn sm" aria-label="Önceki ay" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b>{MONTHS[month]} {year}</b>
              <button type="button" className="btn xs" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Bugün</button>
            </div>
            <button type="button" className="btn sm" aria-label="Sonraki ay" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => <div key={w} style={{ textAlign: "center", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-faint)" }}>{w}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((day, i) => {
              const dayEvents = day ? (eventsByDay.get(day) ?? []) : [];
              const isToday = !!day && isCurrentMonth && day === today.getDate();
              return (
                <div key={i} style={{ minHeight: 88, border: day ? "1px solid var(--border)" : "1px solid transparent", borderRadius: 6, padding: 4, background: day ? (isToday ? "var(--brand-tint)" : "var(--surface)") : "transparent" }}>
                  {day && <div style={{ fontSize: "var(--text-xs)", fontWeight: isToday ? 800 : 600, color: isToday ? "var(--brand)" : "var(--ink-muted)", marginBottom: 2 }}>{day}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} title={`${ev.title}${ev.visibleRoles.length ? " · " + ev.visibleRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ") : " · Herkes"}`} style={{ fontSize: 10, background: "var(--brand)", color: "#fff", borderRadius: 4, padding: "1px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {!ev.allDay && `${new Date(ev.startAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} `}{ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>+{dayEvents.length - 3} daha</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste görünümü */}
      {!eventsQuery.isLoading && view === "list" && (
        <div className="grid cols-2">
          {events.length === 0 && (
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Görünür:</span>
                {ev.visibleRoles.length === 0 ? (
                  <span className="chip">Herkes</span>
                ) : (
                  ev.visibleRoles.map((r) => <span key={r} className="chip strong">{ROLE_LABEL[r] ?? r}</span>)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
