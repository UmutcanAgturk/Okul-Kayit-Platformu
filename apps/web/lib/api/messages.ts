import { apiFetch } from "./client";

export type MessageAudience = "ALL_STUDENTS" | "ALL_GUARDIANS" | "ALL_TEACHERS" | "ALL_STAFF";

export interface MessageAttachmentRow {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export interface SentMessage {
  id: string;
  title: string;
  body: string;
  audienceLabel: string;
  recipientCount: number;
  createdAt: string;
  attachments: MessageAttachmentRow[];
}

export function fetchSentMessages() {
  return apiFetch<{ messages: SentMessage[] }>("/api/branch/messages", { cache: "no-store" });
}

export function sendMessage(input: {
  title: string;
  body: string;
  audience: MessageAudience;
  classroomId?: string;
  attachments?: { fileName: string; mimeType: string; dataUrl: string }[];
}) {
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
  attachments: MessageAttachmentRow[];
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

export type MessageTemplateKind = "bildirim" | "mesaj";

export interface MessageTemplate {
  id: string;
  kind: MessageTemplateKind;
  category: string;
  title: string;
  body: string;
  createdAt: string;
}

export function fetchTemplates() {
  return apiFetch<{ templates: MessageTemplate[] }>("/api/branch/message-templates", { cache: "no-store" });
}

export function createTemplate(input: { kind: MessageTemplateKind; category: string; title: string; body: string }) {
  return apiFetch<{ template: MessageTemplate }>("/api/branch/message-templates", { method: "POST", body: JSON.stringify(input) });
}

export function updateTemplate(templateId: string, input: Partial<{ kind: MessageTemplateKind; category: string; title: string; body: string }>) {
  return apiFetch<{ template: MessageTemplate }>(`/api/branch/message-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTemplate(templateId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/message-templates/${templateId}`, { method: "DELETE" });
}

export const messageKeys = {
  sent: () => ["messages", "sent"] as const,
  inbox: () => ["messages", "inbox"] as const,
  classrooms: () => ["messages", "classrooms"] as const,
  templates: () => ["messages", "templates"] as const,
};
