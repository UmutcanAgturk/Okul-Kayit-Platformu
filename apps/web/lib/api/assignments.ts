import { apiFetch } from "./client";

export interface AssignmentSummary {
  id: string; title: string; description: string | null; classroomId: string | null;
  startDate: string | null; dueDate: string | null; attachments: string[]; submissionCount: number; createdAt: string;
}
export function fetchAssignments() {
  return apiFetch<{ assignments: AssignmentSummary[] }>("/api/branch/assignments", { cache: "no-store" });
}
export function createAssignment(input: { title: string; description?: string; classroomId?: string; startDate?: string; dueDate?: string; attachments?: string[] }) {
  return apiFetch<{ assignment: { id: string } }>("/api/branch/assignments", { method: "POST", body: JSON.stringify(input) });
}
export const assignmentKeys = { branchList: () => ["assignments", "branch-list"] as const };
