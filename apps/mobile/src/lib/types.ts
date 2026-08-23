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

// ---- Öğrenci/Veli portalı modül tipleri (Dalga 1) ----
export interface ExamHistoryRow {
  examId: string; examName: string; examType: string; examDate: string;
  netScore: number; rawScore: number; percentile: number | null;
}
export interface SubjectBreakdownRow { subject: string; achievementCount: number; avgMasteryPct: number; }
export interface ReportCard {
  studentId: string; studentName: string;
  examHistory: ExamHistoryRow[];
  subjectBreakdown: SubjectBreakdownRow[];
  attendanceSummary: { totalDays: number; presentDays: number; lateDays: number; excusedDays: number; absentDays: number; absenceRatePct: number };
  disciplineSummary: { recordCount: number; positiveCount: number; negativeCount: number; netPoints: number };
  summary: { overallAvgMasteryPct: number | null; strongestSubject: string | null; weakestSubject: string | null };
}
export interface AttendanceRecordRow { date: string; status: 'VAR' | 'GEC' | 'IZINLI' | 'YOK'; note: string | null; }
export interface StudentAttendance {
  studentId: string; records: AttendanceRecordRow[];
  summary: { totalDays: number; presentDays: number; lateDays: number; excusedDays: number; absentDays: number; absenceRatePct: number };
}
export interface DisciplineRecordRow { id: string; type: 'OLUMLU' | 'OLUMSUZ'; category: string; note: string | null; points: number; createdAt: string; }
export interface StudentDiscipline { studentId: string; records: DisciplineRecordRow[]; netPoints: number; }
export interface StudentTimetableSlotRow { id: string; subject: string; dayOfWeek: number; startTime: string; endTime: string; teacherName: string; }
export interface CriticalAchievement { achievementId: string; code: string; label: string; subject: string; avgRatio: number; }
export interface StudentRoadmap {
  studentId: string; studentName: string; gradeLevel: string; targetGoal: string | null;
  examCount: number; latestNet: number | null; maxPossibleNet: number | null; netPct: number;
  netTrend: { label: string; value: number }[]; criticalAchievements: CriticalAchievement[];
}
export interface Badge { id: string; label: string; desc: string; earned: boolean; }
export interface StudentGamification {
  xp: number; level: number; xpIntoLevel: number; xpForNextLevel: number; progressPct: number;
  classRank: number | null; classSize: number;
  stats: { examCount: number; attRate: number | null };
  badges?: Badge[];
}
export interface ExamTicketRow {
  examId: string; examName: string; examType: 'DENEME' | 'YAZILI' | 'VIP_OLCME'; examDate: string;
  bookletType: string | null; seatingRoomId: string | null; seatNo: string | null; studentNo: string; studentName: string;
}

// ---- Dalga 2: kalan öğrenci modülleri ----
export interface InboxMessage {
  id: string; senderLabel: string; title: string; body: string;
  audienceLabel: string; createdAt: string; readAt: string | null;
}
export interface StudentBusRoute {
  route: { id: string; name: string; driverName: string | null; driverPhone: string | null; stops: string | null } | null;
}
export interface QuizAttemptRow {
  id: string; subject: string; achievementCode: string | null; achievementLabel: string | null;
  correctCount: number; totalCount: number; createdAt: string;
}
export type MentorRequestStatus = 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI' | 'TAMAMLANDI';
export interface StudentMentorInfo {
  mentor: { id: string; name: string; branch: string } | null;
  quota: { used: number; limit: number } | null;
}
export interface MentorRequestRow {
  id: string; mentorName: string; requestedAt: string; note: string | null; status: MentorRequestStatus;
}
export interface EtutSessionRow {
  id: string; status: StudySessionStatus; scheduledStart: string;
  teacherName: string; achievement: { code: string; label: string } | null;
}

// ---- Dalga 3: Öğretmen portalı ----
export interface MyClassStudentRow {
  studentId: string; studentNo: string; name: string; gradeLevel: string;
  netAvg: number | null; guardianName: string | null; guardianPhone: string | null;
}
export interface MyClassRow { classroomId: string; classroomName: string; students: MyClassStudentRow[]; }
export interface TeacherTimetableSlotRow { id: string; subject: string; dayOfWeek: number; startTime: string; endTime: string; classroomName: string; }
export type PtaRequestStatus = 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI';
export interface TeacherPtaRequest { id: string; studentId: string; studentName: string; requestedAt: string; topic: string | null; status: PtaRequestStatus; createdAt: string; }
export interface TeacherMenteeRow { id: string; name: string; gradeLevel: string; classroomName: string | null; quotaLimit: number; }
export interface TeacherClub { id: string; name: string; description: string | null; memberCount: number; }

// ---- Dalga 4: Şube portalı (okuma) ----
export interface TodaySummary {
  date: string;
  attendance: { classroomsTotal: number; classroomsTakenToday: number };
  payments: { overdueCount: number; upcomingCount: number };
  pta: { pendingCount: number };
  etut: { pendingCount: number };
  recentActivity: { id: string; actorLabel: string; action: string; detail: string | null; createdAt: string }[];
}
export interface OpsPaymentRow { installmentId: string; studentId: string; studentName: string; installmentNo: number; amount: number; dueDate: string; }
export interface OpsEtutSlot { subject: string; time: string; count: number; }
export interface DailyOps { date: string; overduePayments: OpsPaymentRow[]; overdueTotal: number; upcomingPayments: OpsPaymentRow[]; todayEtut: OpsEtutSlot[]; todayEtutTotal: number; }
export interface BranchStudentRow { id: string; studentNo: string; name: string; gradeLevel: string; classroomId: string | null; classroomName: string | null; guardianName: string | null; guardianPhone: string | null; }
export interface StaffMember { id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; status: string; title: string; department: string | null; }
export interface ActivityLogEntry { id: string; actorLabel: string; action: string; detail: string | null; createdAt: string; }
export interface TeacherPerformanceRow { teacherId: string; name: string; branch: string; title: string | null; resultCount: number; avgMasteryPct: number | null; rosterSize: number; avgAttendancePct: number | null; positiveCount: number; negativeCount?: number; }
