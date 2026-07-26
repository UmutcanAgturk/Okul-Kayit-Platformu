export type UserRole =
  | 'SUPERADMIN'
  | 'BRANCH_ADMIN'
  | 'GUIDANCE_COORDINATOR'
  | 'ACCOUNTING'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
}

export interface LinkedStudent {
  studentId: string;
  fullName: string;
  relation?: string;
}

// GET /api/me yanıtı — SessionUser'a rol-özel alanlar eklenmiş hali.
export interface Me extends SessionUser {
  students?: LinkedStudent[];
  teacherId?: string | null;
}

export type PaymentStatus = 'PENDING' | 'PAID';

export interface PaymentInstallment {
  id: string;
  studentId: string;
  studentName?: string;
  installmentNo: number;
  amount: string | number;
  dueDate: string;
  paidAt: string | null;
  status: PaymentStatus;
}

export type StudySessionStatus =
  | 'AI_SUGGESTED'
  | 'TEACHER_APPROVED'
  | 'TEACHER_REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface StudySession {
  id: string;
  status: StudySessionStatus;
  scheduledStart: string;
  scheduledEnd?: string;
  student: { id: string; user?: { firstName: string; lastName: string } };
  achievement?: { code: string; label: string };
}

export type LedgerType = 'GELIR' | 'GIDER';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  category: string;
  amount: string | number;
  entryDate: string;
  note?: string | null;
}

export interface LedgerSummary {
  totalGelir: number;
  totalGider: number;
  net: number;
}

export type MasteryLevel = 'CRITICAL' | 'WEAK' | 'STRONG';

export interface ClassXRayResponse {
  examId: string;
  examName: string;
  classroomId: string;
  classroomName: string;
  generatedAt: string;
  achievementColumns: { achievementId: string; code: string; label: string; subject: string }[];
  students: {
    studentId: string;
    fullName: string;
    overallNet: number;
    cells: { achievementId: string; masteryLevel: MasteryLevel; correctRatio: number; questionCount: number }[];
  }[];
  classSummary: {
    averageNet: number;
    weakestAchievement: { label: string; classAverageRatio: number };
    strongestAchievement: { label: string; classAverageRatio: number };
  };
}
