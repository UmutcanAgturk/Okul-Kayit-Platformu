import { apiFetch } from "./client";

export interface TeacherOption {
  id: string;
  name: string;
  branch: string;
}

export function fetchTeachers() {
  return apiFetch<{ teachers: TeacherOption[] }>("/api/branch/teachers", { cache: "no-store" });
}

// "Ders bazlı öğretmen havuzu" (bkz. task #57 — Etüt Talebi formu): yalnızca
// belirtilen dersi veren (TeacherProfile.branch eşleşen) öğretmenleri döner.
export function fetchTeachersBySubject(subject: string) {
  return apiFetch<{ teachers: TeacherOption[] }>(`/api/branch/teachers?subject=${encodeURIComponent(subject)}`, { cache: "no-store" });
}

export const teacherKeys = {
  list: () => ["teachers", "list"] as const,
};
