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
// --- Öğretmen: teslimler + puanlama ---
export type SubmissionStatus = "ASSIGNED" | "SUBMITTED" | "GRADED";
export interface SubmissionRow {
  studentId: string; studentName: string; submissionId: string | null; status: SubmissionStatus;
  submittedAt: string | null; note: string | null; fileName: string | null; hasFile: boolean;
  grade: string | null; feedback: string | null; gradedAt: string | null;
}
export interface AssignmentSubmissions {
  assignment: { id: string; title: string; description: string | null; dueDate: string | null };
  submittedCount: number; gradedCount: number; total: number; rows: SubmissionRow[];
}
export function fetchAssignmentSubmissions(assignmentId: string) {
  return apiFetch<AssignmentSubmissions>(`/api/branch/assignments/${assignmentId}/submissions`, { cache: "no-store" });
}
export function fetchSubmissionFile(assignmentId: string, submissionId: string) {
  return apiFetch<{ fileName: string | null; mimeType: string | null; dataUrl: string | null; note: string | null }>(`/api/branch/assignments/${assignmentId}/submissions/${submissionId}`, { cache: "no-store" });
}
export function gradeSubmission(assignmentId: string, submissionId: string, input: { grade: string; feedback?: string }) {
  return apiFetch<{ ok: true }>(`/api/branch/assignments/${assignmentId}/submissions/${submissionId}`, { method: "PATCH", body: JSON.stringify(input) });
}

// --- Öğrenci/veli: ödevlerim + teslim ---
export interface StudentAssignment {
  id: string; title: string; description: string | null; dueDate: string | null; attachments: string[];
  status: SubmissionStatus; submittedAt: string | null; note: string | null; fileName: string | null; grade: string | null; feedback: string | null;
}
export function fetchStudentAssignments(studentId: string) {
  return apiFetch<{ assignments: StudentAssignment[] }>(`/api/students/${studentId}/assignments`, { cache: "no-store" });
}
export function submitAssignment(studentId: string, assignmentId: string, input: { note?: string; fileName?: string; mimeType?: string; dataUrl?: string }) {
  return apiFetch<{ id: string }>(`/api/students/${studentId}/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify(input) });
}

export const assignmentKeys = {
  branchList: () => ["assignments", "branch-list"] as const,
  submissions: (assignmentId: string) => ["assignments", "submissions", assignmentId] as const,
  studentList: (studentId: string) => ["assignments", "student", studentId] as const,
};
