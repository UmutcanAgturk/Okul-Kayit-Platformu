import { apiFetch } from "./client";

export interface BranchClub {
  id: string;
  name: string;
  description: string | null;
  advisorTeacherId: string | null;
  advisorName: string | null;
  memberCount: number;
}

export function fetchBranchClubs() {
  return apiFetch<{ clubs: BranchClub[] }>("/api/branch/clubs", { cache: "no-store" });
}

export function createClub(input: { name: string; description?: string; advisorTeacherId?: string }) {
  return apiFetch<{ club: { id: string } }>("/api/branch/clubs", { method: "POST", body: JSON.stringify(input) });
}

export interface ClubRosterRow {
  studentId: string;
  name: string;
  classroom: string | null;
  isMember: boolean;
}

export function fetchClubDetail(clubId: string) {
  return apiFetch<{
    club: { id: string; name: string; description: string | null; advisorTeacherId: string | null };
    roster: ClubRosterRow[];
  }>(`/api/branch/clubs/${clubId}`, { cache: "no-store" });
}

export function toggleClubMember(clubId: string, studentId: string) {
  return apiFetch<{ isMember: boolean }>(`/api/branch/clubs/${clubId}/members`, {
    method: "POST",
    body: JSON.stringify({ studentId }),
  });
}

export interface TeacherClub {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
}

export function fetchTeacherClubs() {
  return apiFetch<{ clubs: TeacherClub[] }>("/api/teacher/clubs", { cache: "no-store" });
}

export interface StudentClub {
  id: string;
  name: string;
  description: string | null;
  advisorName: string | null;
  memberCount: number;
  isMember: boolean;
}

export function fetchStudentClubs() {
  return apiFetch<{ clubs: StudentClub[] }>("/api/clubs", { cache: "no-store" });
}

export function toggleMyClubMembership(clubId: string) {
  return apiFetch<{ isMember: boolean }>(`/api/clubs/${clubId}/membership`, { method: "POST" });
}

export const clubKeys = {
  branchList: () => ["clubs", "branch-list"] as const,
  detail: (clubId: string) => ["clubs", "detail", clubId] as const,
  teacherList: () => ["clubs", "teacher-list"] as const,
  studentList: () => ["clubs", "student-list"] as const,
};
