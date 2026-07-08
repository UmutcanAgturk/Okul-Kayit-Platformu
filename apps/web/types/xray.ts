/**
 * "AI Sınıf Röntgeni" (Kazanım Isı Haritası) için paylaşılan tipler.
 * Backend (Assessment/IRT servisi) ile sözleşme (contract) niteliğindedir.
 */

export type MasteryLevel = "CRITICAL" | "WEAK" | "STRONG";

export interface AchievementColumn {
  achievementId: string;
  code: string; // örn. "MAT.9.1.2.3"
  label: string; // örn. "Rasyonel Sayılarda İşlemler"
  subject: string; // örn. "Matematik"
}

export interface AchievementCell {
  achievementId: string;
  studentId: string;
  masteryLevel: MasteryLevel;
  correctRatio: number; // 0 - 1
  questionCount: number;
}

export interface StudentRow {
  studentId: string;
  fullName: string;
  avatarUrl?: string;
  overallNet: number;
  cells: AchievementCell[]; // achievementColumns ile aynı sırada değil, achievementId ile eşleşir
}

export interface ClassXRayResponse {
  examId: string;
  examName: string;
  classroomId: string;
  classroomName: string;
  generatedAt: string; // ISO date
  achievementColumns: AchievementColumn[];
  students: StudentRow[];
  classSummary: {
    averageNet: number;
    weakestAchievement: Pick<AchievementColumn, "achievementId" | "label"> & {
      classAverageRatio: number;
    };
    strongestAchievement: Pick<AchievementColumn, "achievementId" | "label"> & {
      classAverageRatio: number;
    };
  };
}
