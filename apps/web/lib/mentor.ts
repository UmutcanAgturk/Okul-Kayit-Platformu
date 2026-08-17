import { GradeLevel } from "@prisma/client";

// demo/seviye360-app.html'deki mentorMonthlyQuota() ile birebir aynı — 8./12.
// sınıf ve mezunlar ayda 2, diğer sınıf düzeyleri ayda 1 randevu hakkına sahip.
export function mentorMonthlyQuota(gradeLevel: GradeLevel): number {
  return gradeLevel === GradeLevel.SINIF_8 || gradeLevel === GradeLevel.SINIF_12 || gradeLevel === GradeLevel.MEZUN ? 2 : 1;
}
