import { apiFetch } from "./client";

export type DisciplineType = "OLUMLU" | "OLUMSUZ";

export const DISCIPLINE_CATEGORIES: Record<DisciplineType, string[]> = {
  OLUMLU: ["Derse Katılım", "Yardımseverlik", "Liderlik", "Ödev Tamamlama", "Diğer"],
  OLUMSUZ: ["Derse Geç Kalma", "Ödev Yapmama", "Kurallara Uymama", "Saygısız Davranış", "Diğer"],
};

export interface ClassroomStudent {
  studentId: string;
  name: string;
}

export function fetchClassroomStudents(classroomId: string) {
  return apiFetch<{ students: ClassroomStudent[] }>(`/api/branch/classrooms/${classroomId}/students`, {
    cache: "no-store",
  });
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  studentName: string;
  type: DisciplineType;
  category: string;
  note: string | null;
  points: number;
  createdAt: string;
}

export function fetchDisciplineRecords(studentId?: string) {
  const qs = studentId ? `?studentId=${studentId}` : "";
  return apiFetch<{ records: DisciplineRecord[] }>(`/api/branch/discipline${qs}`, { cache: "no-store" });
}

export function createDisciplineRecord(input: {
  studentId: string;
  type: DisciplineType;
  category: string;
  note?: string;
}) {
  return apiFetch<{ record: DisciplineRecord }>("/api/branch/discipline", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface StudentDisciplineRecord {
  id: string;
  type: DisciplineType;
  category: string;
  note: string | null;
  points: number;
  createdAt: string;
}

export function fetchStudentDiscipline(studentId: string) {
  return apiFetch<{ studentId: string; records: StudentDisciplineRecord[]; netPoints: number }>(
    `/api/students/${studentId}/discipline`,
    { cache: "no-store" },
  );
}

export const disciplineKeys = {
  classroomStudents: (classroomId: string) => ["discipline", "classroom-students", classroomId] as const,
  records: (studentId?: string) => ["discipline", "records", studentId ?? "ALL"] as const,
  byStudent: (studentId: string) => ["discipline", "student", studentId] as const,
};
