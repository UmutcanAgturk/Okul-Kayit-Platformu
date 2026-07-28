import { apiFetch } from "./client";

export type MentorRequestStatus = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI" | "TAMAMLANDI";

export interface StudentMentorInfo {
  mentor: { id: string; name: string; branch: string } | null;
  quota: { used: number; limit: number } | null;
}

export function fetchStudentMentor(studentId: string) {
  return apiFetch<StudentMentorInfo>(`/api/students/${studentId}/mentor`, { cache: "no-store" });
}

export interface MentorRequestRow {
  id: string;
  mentorTeacherId?: string;
  mentorName: string;
  studentId?: string;
  studentName?: string;
  requestedAt: string;
  note: string | null;
  status: MentorRequestStatus;
  createdAt: string;
}

export function fetchStudentMentorRequests(studentId: string) {
  return apiFetch<{ requests: MentorRequestRow[] }>(`/api/students/${studentId}/mentor-requests`, { cache: "no-store" });
}

export function createMentorRequest(studentId: string, input: { requestedAt: string; note?: string }) {
  return apiFetch<{ request: { id: string } }>(`/api/students/${studentId}/mentor-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchTeacherMentorRequests() {
  return apiFetch<{ requests: MentorRequestRow[] }>("/api/teacher/mentor-requests", { cache: "no-store" });
}

export function respondToMentorRequest(requestId: string, decision: "APPROVE" | "REJECT" | "COMPLETE") {
  return apiFetch<{ request: { id: string; status: MentorRequestStatus } }>(`/api/teacher/mentor-requests/${requestId}/respond`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export function fetchBranchMentorRequests() {
  return apiFetch<{ requests: MentorRequestRow[] }>("/api/branch/mentor-requests", { cache: "no-store" });
}

export interface BranchTeacher {
  id: string;
  name: string;
  branch: string;
  isMentor: boolean;
}

export function fetchBranchTeachers() {
  return apiFetch<{ teachers: BranchTeacher[] }>("/api/branch/teachers", { cache: "no-store" });
}

export function toggleTeacherMentor(teacherId: string) {
  return apiFetch<{ isMentor: boolean }>(`/api/branch/teachers/${teacherId}/mentor`, { method: "POST" });
}

export const mentorKeys = {
  studentMentor: (studentId: string) => ["mentor", "student", studentId] as const,
  studentRequests: (studentId: string) => ["mentor", "student-requests", studentId] as const,
  teacherRequests: () => ["mentor", "teacher-requests"] as const,
  branchRequests: () => ["mentor", "branch-requests"] as const,
  branchTeachers: () => ["mentor", "branch-teachers"] as const,
};
