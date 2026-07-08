import { NextRequest, NextResponse } from "next/server";
import type {
  AchievementColumn,
  ClassXRayResponse,
  MasteryLevel,
  StudentRow,
} from "@/types/xray";

/**
 * Mockup endpoint — FAZ 1 demo verisi.
 * Prodüksiyonda bu route, Assessment mikroservisinin
 * `GET /internal/exams/:examId/class-xray` uç noktasına proxy yapar
 * (bkz. IRT tabanlı kazanım analiz motoru).
 */

const ACHIEVEMENTS: AchievementColumn[] = [
  { achievementId: "a1", code: "MAT.9.1.2.3", label: "Rasyonel Sayılar", subject: "Matematik" },
  { achievementId: "a2", code: "MAT.9.2.1.1", label: "Denklem Kurma", subject: "Matematik" },
  { achievementId: "a3", code: "FIZ.9.3.1.4", label: "Hareket ve Kuvvet", subject: "Fizik" },
  { achievementId: "a4", code: "KIM.9.1.4.2", label: "Atom Modelleri", subject: "Kimya" },
  { achievementId: "a5", code: "TUR.9.4.2.1", label: "Paragrafta Anlam", subject: "Türkçe" },
  { achievementId: "a6", code: "TAR.9.2.3.1", label: "Osmanlı Kuruluş Dönemi", subject: "Tarih" },
];

const STUDENT_NAMES = [
  "Ahmet Yılmaz",
  "Zeynep Kaya",
  "Mehmet Demir",
  "Elif Şahin",
  "Emre Çelik",
  "Ayşe Aydın",
  "Burak Arslan",
  "Deniz Koç",
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function ratioToMastery(ratio: number): MasteryLevel {
  if (ratio < 0.4) return "CRITICAL";
  if (ratio < 0.7) return "WEAK";
  return "STRONG";
}

function buildMockClassXRay(examId: string, classroomId: string): ClassXRayResponse {
  const random = seededRandom(examId.length * 31 + classroomId.length * 7 + 1);

  const students: StudentRow[] = STUDENT_NAMES.map((fullName, studentIdx) => {
    const cells = ACHIEVEMENTS.map((achievement) => {
      const ratio = Math.min(1, Math.max(0, random() * 1.1 - studentIdx * 0.02));
      return {
        achievementId: achievement.achievementId,
        studentId: `s-${studentIdx + 1}`,
        masteryLevel: ratioToMastery(ratio),
        correctRatio: Number(ratio.toFixed(2)),
        questionCount: 5,
      };
    });

    const overallNet = Number(
      (cells.reduce((sum, c) => sum + c.correctRatio, 0) / cells.length * 20).toFixed(1),
    );

    return { studentId: `s-${studentIdx + 1}`, fullName, overallNet, cells };
  });

  const achievementAverages = ACHIEVEMENTS.map((achievement) => {
    const values = students.flatMap((s) =>
      s.cells.filter((c) => c.achievementId === achievement.achievementId).map((c) => c.correctRatio),
    );
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { achievement, avg };
  });

  const weakest = achievementAverages.reduce((a, b) => (a.avg < b.avg ? a : b));
  const strongest = achievementAverages.reduce((a, b) => (a.avg > b.avg ? a : b));

  return {
    examId,
    examName: "Seviye 360 - 9. Sınıf Genel Deneme #4",
    classroomId,
    classroomName: "9-A",
    generatedAt: new Date().toISOString(),
    achievementColumns: ACHIEVEMENTS,
    students,
    classSummary: {
      averageNet: Number(
        (students.reduce((sum, s) => sum + s.overallNet, 0) / students.length).toFixed(1),
      ),
      weakestAchievement: {
        achievementId: weakest.achievement.achievementId,
        label: weakest.achievement.label,
        classAverageRatio: Number(weakest.avg.toFixed(2)),
      },
      strongestAchievement: {
        achievementId: strongest.achievement.achievementId,
        label: strongest.achievement.label,
        classAverageRatio: Number(strongest.avg.toFixed(2)),
      },
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } },
) {
  const classroomId = request.nextUrl.searchParams.get("classroomId") ?? "unknown";

  if (!params.examId) {
    return NextResponse.json({ message: "examId zorunludur" }, { status: 400 });
  }

  const data = buildMockClassXRay(params.examId, classroomId);
  return NextResponse.json(data);
}
