import { apiFetch } from "./client";

export interface TeacherOption {
  id: string;
  name: string;
  branch: string;
  salary: string | null;
}

export function fetchTeachers() {
  return apiFetch<{ teachers: TeacherOption[] }>("/api/branch/teachers", { cache: "no-store" });
}

// "Ders bazlı öğretmen havuzu" (bkz. task #57 — Etüt Talebi formu): yalnızca
// belirtilen dersi veren (TeacherProfile.branch eşleşen) öğretmenleri döner.
export function fetchTeachersBySubject(subject: string) {
  return apiFetch<{ teachers: TeacherOption[] }>(`/api/branch/teachers?subject=${encodeURIComponent(subject)}`, { cache: "no-store" });
}

// Personel ekranındaki Öğretmenler modülü için (task #88) — bkz.
// app/api/branch/teachers/route.ts ?full=true notu.
export interface TeacherFull {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  branch: string;
  title: string | null;
  isMentor: boolean;
  salary: string | null;
}

export function fetchTeachersFull() {
  return apiFetch<{ teachers: TeacherFull[] }>("/api/branch/teachers?full=true", { cache: "no-store" });
}

export function createTeacher(input: { fullName: string; branch: string; title?: string; phone?: string; email?: string; salary?: number }) {
  return apiFetch<{ teacher: TeacherFull; credentials: { username: string; password: string } }>("/api/branch/teachers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTeacherProfile(
  teacherId: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    branch: string;
    title: string | null;
    phone: string | null;
    isActive: boolean;
    isMentor: boolean;
    salary: number | null;
  }>,
) {
  return apiFetch<{ teacher: TeacherFull }>(`/api/branch/teachers/${teacherId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function updateTeacherUsername(teacherId: string, username: string) {
  return apiFetch<{ teacher: TeacherFull }>(`/api/branch/teachers/${teacherId}`, { method: "PATCH", body: JSON.stringify({ username }) });
}

export function deactivateTeacher(teacherId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/teachers/${teacherId}`, { method: "DELETE" });
}

export function permanentlyDeleteTeacher(teacherId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/teachers/${teacherId}?permanent=true`, { method: "DELETE" });
}

export const teacherKeys = {
  list: () => ["teachers", "list"] as const,
  full: () => ["teachers", "full"] as const,
};
