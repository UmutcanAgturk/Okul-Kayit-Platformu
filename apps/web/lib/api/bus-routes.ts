import { apiFetch } from "./client";

export interface BusRouteSummary {
  id: string;
  name: string;
  driverName: string | null;
  driverPhone: string | null;
  capacity: number;
  stops: string[];
  memberCount: number;
}

export function fetchBusRoutes() {
  return apiFetch<{ routes: BusRouteSummary[] }>("/api/branch/bus-routes", { cache: "no-store" });
}

export function createBusRoute(input: { name: string; driverName?: string; driverPhone?: string; capacity?: number; stops?: string[] }) {
  return apiFetch<{ route: { id: string } }>("/api/branch/bus-routes", { method: "POST", body: JSON.stringify(input) });
}

export interface BusRouteRosterRow {
  studentId: string;
  name: string;
  classroom: string | null;
  isMember: boolean;
}

export function fetchBusRouteDetail(routeId: string) {
  return apiFetch<{
    route: { id: string; name: string; driverName: string | null; driverPhone: string | null; capacity: number; stops: string[] };
    roster: BusRouteRosterRow[];
  }>(`/api/branch/bus-routes/${routeId}`, { cache: "no-store" });
}

export function toggleBusRouteMember(routeId: string, studentId: string) {
  return apiFetch<{ isMember: boolean }>(`/api/branch/bus-routes/${routeId}/members`, {
    method: "POST",
    body: JSON.stringify({ studentId }),
  });
}

export interface StudentBusRoute {
  id: string;
  name: string;
  driverName: string | null;
  driverPhone: string | null;
  stops: string[];
}

export function fetchStudentBusRoute(studentId: string) {
  return apiFetch<{ route: StudentBusRoute | null }>(`/api/students/${studentId}/bus-route`, { cache: "no-store" });
}

export const busRouteKeys = {
  branchList: () => ["bus-routes", "branch-list"] as const,
  detail: (routeId: string) => ["bus-routes", "detail", routeId] as const,
  byStudent: (studentId: string) => ["bus-routes", "student", studentId] as const,
};
