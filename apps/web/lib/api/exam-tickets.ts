import { apiFetch } from "./client";

export interface ExamTicketRow {
  examId: string;
  examName: string;
  examType: "DENEME" | "YAZILI" | "VIP_OLCME";
  examDate: string;
  bookletType: string | null;
  seatingRoomId: string | null;
  seatNo: string | null;
  studentNo: string;
  studentName: string;
}

export function fetchExamTickets(studentId: string) {
  return apiFetch<{ tickets: ExamTicketRow[] }>(`/api/students/${studentId}/exam-tickets`, { cache: "no-store" });
}
