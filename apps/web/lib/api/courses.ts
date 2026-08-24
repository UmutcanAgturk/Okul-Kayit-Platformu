import { apiFetch } from "./client";

export interface CourseSummary {
  id: string; code: string; name: string; description: string | null;
  credit: number | null; weeklyHours: number | null; mandatory: boolean; gradeLevels: string[];
}
export function fetchCourses() {
  return apiFetch<{ courses: CourseSummary[] }>("/api/branch/courses", { cache: "no-store" });
}
export function createCourse(input: { code: string; name: string; description?: string; credit?: number; weeklyHours?: number; mandatory?: boolean; gradeLevels?: string[] }) {
  return apiFetch<{ course: { id: string } }>("/api/branch/courses", { method: "POST", body: JSON.stringify(input) });
}
export const courseKeys = { branchList: () => ["courses", "branch-list"] as const };
