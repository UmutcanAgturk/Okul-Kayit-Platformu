import { apiFetch } from "./client";

export interface ConversationSummary {
  id: string; subject: string; otherName: string; otherRole: string;
  studentName: string | null; lastMessage: string | null; lastMessageAt: string; unread: number;
}
export interface ConversationThread {
  subject: string; otherName: string; otherRole: string; studentName: string | null;
  messages: { id: string; body: string; mine: boolean; createdAt: string }[];
}

export function fetchConversations() {
  return apiFetch<{ conversations: ConversationSummary[] }>("/api/conversations", { cache: "no-store" });
}
export function fetchConversation(id: string) {
  return apiFetch<ConversationThread>(`/api/conversations/${id}`, { cache: "no-store" });
}
export function startConversation(input: { studentId: string; subject: string; firstMessage: string; otherUserId?: string }) {
  return apiFetch<{ id: string }>("/api/conversations", { method: "POST", body: JSON.stringify(input) });
}
export function sendConversationMessage(id: string, body: string) {
  return apiFetch<{ ok: true }>(`/api/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
}
export function fetchStudentTeachers(studentId: string) {
  return apiFetch<{ teachers: { userId: string; name: string }[] }>(`/api/students/${studentId}/teachers`, { cache: "no-store" });
}

export const conversationKeys = {
  list: () => ["conversations", "list"] as const,
  thread: (id: string) => ["conversations", "thread", id] as const,
};
