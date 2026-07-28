import { apiFetch } from "./client";

export interface TeacherOption {
  id: string;
  name: string;
  branch: string;
}

export function fetchTeachers() {
  return apiFetch<{ teachers: TeacherOption[] }>("/api/branch/teachers", { cache: "no-store" });
}

export const teacherKeys = {
  list: () => ["teachers", "list"] as const,
};
