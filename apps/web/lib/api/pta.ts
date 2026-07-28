import { apiFetch } from "./client";

export type PtaRequestStatus = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";

export interface StudentPtaRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  requestedAt: string;
  topic: string | null;
  status: PtaRequestStatus;
  createdAt: string;
}

export function fetchStudentPtaRequests(studentId: string) {
  return apiFetch<{ studentId: string; requests: StudentPtaRequest[] }>(
    `/api/students/${studentId}/pta-requests`,
    { cache: "no-store" },
  );
}

export function createPtaRequest(studentId: string, input: { teacherId: string; requestedAt: string; topic?: string }) {
  return apiFetch<{ request: { id: string } }>(`/api/students/${studentId}/pta-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface TeacherPtaRequest {
  id: string;
  studentId: string;
  studentName: string;
  requestedAt: string;
  topic: string | null;
  status: PtaRequestStatus;
  createdAt: string;
}

export function fetchTeacherPtaRequests() {
  return apiFetch<{ requests: TeacherPtaRequest[] }>("/api/teacher/pta-requests", { cache: "no-store" });
}

export function respondToPtaRequest(requestId: string, decision: "APPROVE" | "REJECT") {
  return apiFetch<{ request: { id: string; status: PtaRequestStatus } }>(
    `/api/teacher/pta-requests/${requestId}/respond`,
    { method: "POST", body: JSON.stringify({ decision }) },
  );
}

export interface BranchPtaRequest {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  requestedAt: string;
  topic: string | null;
  status: PtaRequestStatus;
  createdAt: string;
}

export function fetchBranchPtaRequests() {
  return apiFetch<{ requests: BranchPtaRequest[] }>("/api/branch/pta-requests", { cache: "no-store" });
}

export const ptaKeys = {
  byStudent: (studentId: string) => ["pta", "student", studentId] as const,
  teacherInbox: () => ["pta", "teacher-inbox"] as const,
  branchAll: () => ["pta", "branch-all"] as const,
};
