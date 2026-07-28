import { apiFetch } from "./client";

export type MessageAudience = "ALL_STUDENTS" | "ALL_GUARDIANS" | "ALL_TEACHERS" | "ALL_STAFF";

export interface SentMessage {
  id: string;
  title: string;
  body: string;
  audienceLabel: string;
  recipientCount: number;
  createdAt: string;
}

export function fetchSentMessages() {
  return apiFetch<{ messages: SentMessage[] }>("/api/branch/messages", { cache: "no-store" });
}

export function sendMessage(input: { title: string; body: string; audience: MessageAudience; classroomId?: string }) {
  return apiFetch<{ message: SentMessage }>("/api/branch/messages", { method: "POST", body: JSON.stringify(input) });
}

export interface InboxMessage {
  id: string;
  senderLabel: string;
  title: string;
  body: string;
  audienceLabel: string;
  createdAt: string;
  readAt: string | null;
}

export function fetchInbox() {
  return apiFetch<{ messages: InboxMessage[]; unreadCount: number }>("/api/messages/inbox", { cache: "no-store" });
}

export function markMessageRead(messageId: string) {
  return apiFetch<{ readAt: string }>(`/api/messages/${messageId}`, { method: "PATCH" });
}

export function deleteInboxMessage(messageId: string) {
  return apiFetch<{ ok: true }>(`/api/messages/${messageId}`, { method: "DELETE" });
}

export interface BranchClassroom {
  id: string;
  name: string;
  gradeLevel: string;
  studentCount: number;
}

export function fetchClassroomsForMessaging() {
  return apiFetch<{ classrooms: BranchClassroom[] }>("/api/branch/classrooms", { cache: "no-store" });
}

export const messageKeys = {
  sent: () => ["messages", "sent"] as const,
  inbox: () => ["messages", "inbox"] as const,
  classrooms: () => ["messages", "classrooms"] as const,
};
