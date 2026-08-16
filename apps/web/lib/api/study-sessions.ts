import { apiFetch } from "./client";

export type StudySessionStatus = "AI_SUGGESTED" | "TEACHER_APPROVED" | "TEACHER_REJECTED" | "COMPLETED" | "CANCELLED";

export const STUDY_SESSION_STATUS_LABEL: Record<StudySessionStatus, string> = {
  AI_SUGGESTED: "Onay Bekliyor",
  TEACHER_APPROVED: "Onaylandı",
  TEACHER_REJECTED: "Reddedildi",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
};

export interface StudentStudySessionRow {
  id: string;
  status: StudySessionStatus;
  scheduledStart: string;
  scheduledEnd: string;
  teacherName: string;
  achievement: { code: string; label: string };
}

export function fetchStudentStudySessions(studentId: string) {
  return apiFetch<{ sessions: StudentStudySessionRow[] }>(`/api/students/${studentId}/study-sessions`, { cache: "no-store" });
}

export interface TeacherStudySessionRow {
  id: string;
  status: StudySessionStatus;
  scheduledStart: string;
  scheduledEnd: string;
  student: { id: string; user: { firstName: string; lastName: string } };
  achievement: { code: string; label: string } | null;
}

export function fetchTeacherStudySessions() {
  return apiFetch<{ sessions: TeacherStudySessionRow[] }>("/api/teacher/study-sessions", { cache: "no-store" });
}

export function respondToStudySession(sessionId: string, decision: "APPROVE" | "REJECT") {
  return apiFetch<{ session: unknown }>(`/api/teacher/study-sessions/${sessionId}/respond`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
