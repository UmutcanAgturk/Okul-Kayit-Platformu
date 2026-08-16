import { GradeLevel } from "@prisma/client";

// GradeLevel enum'un tanım sırası (bkz. prisma/schema.prisma) demo'daki
// GRADE_LEVELS dizisiyle birebir aynı sırayı takip eder — kademe (tier)
// hesaplaması bu sıraya göre yapılır (bkz. demo'daki gradeTier()).
const GRADE_LEVEL_ORDER: GradeLevel[] = [
  GradeLevel.ANASINIFI_3_YAS,
  GradeLevel.ANASINIFI_4_YAS,
  GradeLevel.ANASINIFI_5_YAS,
  GradeLevel.SINIF_1,
  GradeLevel.SINIF_2,
  GradeLevel.SINIF_3,
  GradeLevel.SINIF_4,
  GradeLevel.SINIF_5,
  GradeLevel.SINIF_6,
  GradeLevel.SINIF_7,
  GradeLevel.SINIF_8,
  GradeLevel.SINIF_9,
  GradeLevel.SINIF_10,
  GradeLevel.SINIF_11,
  GradeLevel.SINIF_12,
  GradeLevel.MEZUN,
];

export type GradeTier = "Anaokulu" | "İlkokul" | "Ortaokul" | "Lise" | "Mezun";

export function gradeTier(gradeLevel: GradeLevel): GradeTier | null {
  const idx = GRADE_LEVEL_ORDER.indexOf(gradeLevel);
  if (idx < 0) return null;
  if (idx <= 2) return "Anaokulu";
  if (idx <= 6) return "İlkokul";
  if (idx <= 10) return "Ortaokul";
  if (idx <= 14) return "Lise";
  return "Mezun";
}

// Otomatik optik form ihtiyacı: Ortaokul öğrencisi başına 2 optik, Lise
// öğrencisi başına 1 optik (bkz. demo'daki opticPerStudent — Genel Sınav
// Merkezi'nin gerçek karşılığı, app/api/hq/exams).
export function opticFormsPerStudent(gradeLevel: GradeLevel): number {
  const tier = gradeTier(gradeLevel);
  if (tier === "Ortaokul") return 2;
  if (tier === "Lise") return 1;
  return 0;
}

// Sınav kapsamına dahil edilebilecek sınıf düzeyleri — yalnızca Ortaokul +
// Lise (deneme sınavı/optik değerlendirme bu kademelerde uygulanır).
export const EXAM_ELIGIBLE_GRADE_LEVELS: GradeLevel[] = GRADE_LEVEL_ORDER.filter(
  (g) => gradeTier(g) === "Ortaokul" || gradeTier(g) === "Lise",
);

// Şube kodu öneki (demo'daki gradeClassroomCode() ile birebir aynı desen):
// "9-A" gibi sınıf isimlerinin sınıf-düzeyi kısmı. Mezun için şube açılamaz.
export function gradeClassroomPrefix(gradeLevel: GradeLevel): string | null {
  switch (gradeLevel) {
    case GradeLevel.ANASINIFI_3_YAS:
      return "Ana3";
    case GradeLevel.ANASINIFI_4_YAS:
      return "Ana4";
    case GradeLevel.ANASINIFI_5_YAS:
      return "Ana5";
    case GradeLevel.MEZUN:
      return null;
    default:
      return gradeLevel.replace("SINIF_", "");
  }
}

export const CLASSROOM_ELIGIBLE_GRADE_LEVELS: GradeLevel[] = GRADE_LEVEL_ORDER.filter(
  (g) => g !== GradeLevel.MEZUN,
);
