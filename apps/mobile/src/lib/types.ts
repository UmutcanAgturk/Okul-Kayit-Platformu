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

export interface AgingBucket {
  id: string;
  label: string;
  count: number;
  amount: number;
}

export interface AgingRow {
  studentId: string;
  studentName: string;
  count: number;
  totalAmount: number;
  daysLate: number;
  oldestDueDate: string;
  bucketId: string;
}

export interface HqTenantSummary {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  entryCount: number;
  totalGelir: number;
  totalGider: number;
  net: number;
}

// GET /api/branch/students yanıtındaki bir satır (bkz. apps/web/lib/api/students-roster.ts BranchStudentRow).
export interface StudentRow {
  id: string;
  studentNo: string;
  name: string;
  gradeLevel: string;
  classroomId: string | null;
  classroomName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

// apps/web/lib/api/enrollments.ts GRADE_LEVEL_LABEL ile aynı.
export const GRADE_LEVEL_LABEL: Record<string, string> = {
  ANASINIFI_3_YAS: 'Anasınıfı (3 Yaş)',
  ANASINIFI_4_YAS: 'Anasınıfı (4 Yaş)',
  ANASINIFI_5_YAS: 'Anasınıfı (5 Yaş)',
  SINIF_1: '1. Sınıf',
  SINIF_2: '2. Sınıf',
  SINIF_3: '3. Sınıf',
  SINIF_4: '4. Sınıf',
  SINIF_5: '5. Sınıf',
  SINIF_6: '6. Sınıf',
  SINIF_7: '7. Sınıf',
  SINIF_8: '8. Sınıf',
  SINIF_9: '9. Sınıf',
  SINIF_10: '10. Sınıf',
  SINIF_11: '11. Sınıf',
  SINIF_12: '12. Sınıf',
  MEZUN: 'Mezun',
};

// GET /api/branch/today-summary yanıtı (bkz. apps/web/app/api/branch/today-summary/route.ts).
export interface TodaySummary {
  date: string;
  attendance: {
    classroomsTotal: number;
    classroomsTakenToday: number;
    trend: { date: string; ratePct: number }[];
  };
  payments: {
    overdueCount: number;
    upcomingCount: number;
    studentComposition: { current: number; upcoming: number; overdue: number };
  };
  pta: {
    pendingCount: number;
    today: { id: string; studentName: string; teacherName: string; requestedAt: string; status: string }[];
  };
  etut: { pendingCount: number };
  recentActivity: { id: string; actorLabel: string; action: string; detail: string; createdAt: string }[];
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
