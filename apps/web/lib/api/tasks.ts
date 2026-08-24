import { apiFetch } from "./client";

export interface TaskSummary {
  id: string; title: string; description: string | null; priority: string; status: string;
  dueDate: string | null; requiresApproval: boolean; approvalCount: number; createdAt: string;
}
export function fetchTasks() {
  return apiFetch<{ tasks: TaskSummary[] }>("/api/branch/tasks", { cache: "no-store" });
}
export function createTask(input: { title: string; description?: string; priority?: string; dueDate?: string; requiresApproval?: boolean }) {
  return apiFetch<{ task: { id: string } }>("/api/branch/tasks", { method: "POST", body: JSON.stringify(input) });
}
export function updateTaskStatus(taskId: string, status: string) {
  return apiFetch<{ ok: true }>(`/api/branch/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}
export const taskKeys = { branchList: () => ["tasks", "branch-list"] as const };
