import { apiFetch } from "./client";

export interface BranchStudentRow {
  id: string;
  studentNo: string;
  name: string;
  gradeLevel: string;
  classroomId: string | null;
  classroomName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  // Arşivlenmiş (pasife alınmış) öğrenci — yalnızca arşiv görünümünde döner.
  archived?: boolean;
}

export interface BranchClassroom {
  id: string;
  name: string;
  gradeLevel: string;
  capacity: number;
  studentCount: number;
}

export const studentsRosterKeys = {
  all: () => ["branch-students"] as const,
};

export function fetchBranchStudents() {
  return apiFetch<{ students: BranchStudentRow[] }>("/api/branch/students", { cache: "no-store" });
}

// Arşivlenenler dahil TÜM öğrenciler (arşiv görünümü için) — ayrı bir fonksiyon,
// çünkü fetchBranchStudents doğrudan React Query queryFn'i olarak kullanılıyor
// (parametre eklemek context nesnesini argümana geçirir).
export function fetchBranchStudentsIncludingArchived() {
  return apiFetch<{ students: BranchStudentRow[] }>("/api/branch/students?includeArchived=1", { cache: "no-store" });
}

export function fetchBranchClassrooms() {
  return apiFetch<{ classrooms: BranchClassroom[] }>("/api/branch/classrooms", { cache: "no-store" });
}

export function createClassroom(input: { gradeLevel: string; suffix: string; capacity: number }) {
  return apiFetch<{ classroom: BranchClassroom }>("/api/branch/classrooms", { method: "POST", body: JSON.stringify(input) });
}

export function updateClassroom(classroomId: string, input: Partial<{ suffix: string; capacity: number }>) {
  return apiFetch<{ classroom: BranchClassroom }>(`/api/branch/classrooms/${classroomId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteClassroom(classroomId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/classrooms/${classroomId}`, { method: "DELETE" });
}

export interface ClassroomDetail {
  classroom: { id: string; name: string; gradeLevel: string; capacity: number };
  students: { id: string; studentNo: string; name: string; guardianName: string | null; guardianPhone: string | null }[];
  subjectTeachers: { subject: string; teacherName: string }[];
  weeklyPlan: { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string; teacherName: string }[];
}

export function fetchClassroomDetail(classroomId: string) {
  return apiFetch<ClassroomDetail>(`/api/branch/classrooms/${classroomId}/detail`, { cache: "no-store" });
}

export function assignStudentClassroom(studentId: string, classroomId: string | null) {
  return apiFetch<{ studentId: string; classroomId: string | null; classroomName: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify({ classroomId }) },
  );
}

export function updateStudentGuardianContact(studentId: string, input: { guardianFullName: string; guardianPhone: string }) {
  return apiFetch<{ studentId: string; guardianName: string | null; guardianPhone: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

// task #91 — öğrencinin kendi telefonu/e-postası/hedefi (veli bilgisinden AYRI).
export function updateStudentOwnContact(studentId: string, input: Partial<{ phone: string; email: string; targetGoal: string | null }>) {
  return apiFetch<{ studentId: string; phone: string | null; email: string; targetGoal: string | null }>(
    `/api/branch/students/${studentId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteStudentPermanently(studentId: string) {
  return apiFetch<{ ok: true }>(`/api/branch/students/${studentId}?permanent=true`, { method: "DELETE" });
}

/**
 * Öğrenciyi arşivler (pasife alır) veya arşivden geri alır. Kalıcı silmenin
 * güvenli, geri alınabilir alternatifi — kayıtlar korunur, öğrenci yalnızca
 * roster'dan gizlenir ve girişi kapanır (bkz. app/api/branch/students/[id] PATCH).
 */
export function setStudentArchived(studentId: string, archived: boolean) {
  return apiFetch<{ studentId: string; archived: boolean }>(`/api/branch/students/${studentId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
}

// task #91 — Öğrenci Hızlı Görüntüle/Düzenle Çekmecesi'nin zengin detay verisi
// (kimlik, ödeme durumu, son sınav istatistiği, kazanım etiketleri, AI profil).
export type PaymentStatusBadge = "TAKSIT_YOK" | "GECIKMIS" | "PLANLI" | "GUNCEL";

export interface AchievementTag {
  code: string;
  label: string;
  ratio: number;
}

export interface StudentDetail {
  id: string;
  studentNo: string;
  nationalId: string | null;
  birthDate: string | null;
  gender: string | null;
  photoDataUrl: string | null;
  targetGoal: string | null;
  email: string;
  phone: string | null;
  paymentStatus: PaymentStatusBadge;
  lastExamStats: { correct: number; wrong: number; empty: number; netScore: number; correctRatio: number | null } | null;
  aiProfile: { netTrend: number | null; priorityAchievements: AchievementTag[] } | null;
  achievementTags: { strong: AchievementTag[]; weak: AchievementTag[]; critical: AchievementTag[] };
}

export function fetchStudentDetail(studentId: string) {
  return apiFetch<{ student: StudentDetail }>(`/api/branch/students/${studentId}/detail`, { cache: "no-store" });
}
