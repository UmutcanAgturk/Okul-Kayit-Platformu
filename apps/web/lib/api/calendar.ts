import { apiFetch } from "./client";

export interface CalendarEventSummary {
  id: string;
  title: string;
  eventType: string | null;
  location: string | null;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
}

export function fetchCalendarEvents() {
  return apiFetch<{ events: CalendarEventSummary[] }>("/api/branch/calendar", { cache: "no-store" });
}

export function createCalendarEvent(input: {
  title: string;
  eventType?: string;
  location?: string;
  description?: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
}) {
  return apiFetch<{ event: { id: string } }>("/api/branch/calendar", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteCalendarEvent(eventId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/calendar/${eventId}`, { method: "DELETE" });
}

export const calendarKeys = {
  branchList: () => ["calendar", "branch-list"] as const,
};
