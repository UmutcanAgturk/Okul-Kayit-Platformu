import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";
import type {
  AchievementColumn,
  ClassXRayResponse,
  MasteryLevel,
  StudentRow,
} from "@/types/xray";

/**
 * AI Sınıf Röntgeni — üçüncü gerçek modül. Taksit tahsilatı ve Etüt onay/red
 * API'lerindeki deseni (gerçek Postgres + RLS + oturum tabanlı kimlik)
 * tekrarlar: artık sabit mock veri üretmiyor, `Exam` / `ExamQuestion` /
 * `ExamResult` / `StudentAchievementResult` tablolarından gerçek bir kazanım
 * ısı haritası hesaplıyor. Prodüksiyonda bu route muhtemelen Assessment
 * mikroservisinin (IRT motoru) önünde ince bir proxy/agregasyon katmanı
 * olurdu; burada doğrudan Prisma ile hesaplanıyor.
 */

function ratioToMastery(ratio: number): MasteryLevel {
  if (ratio < 0.4) return "CRITICAL";
  if (ratio < 0.7) return "WEAK";
  return "STRONG";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum bulunamadı" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Bu kaynağa erişim yetkiniz yok" }, { status: 403 });
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId");
  if (!params.examId || !classroomId) {
    return NextResponse.json({ message: "examId ve classroomId zorunludur" }, { status: 400 });
  }

  const data = await withTenantContext(
    { tenantId: actor.tenantId, role: actor.role },
    async (tx): Promise<ClassXRayResponse | null> => {
      const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
      if (!classroom) return null;

      const exam = await tx.exam.findUnique({ where: { id: params.examId } });
      if (!exam) return null;

      const examQuestions = await tx.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { orderIndex: "asc" },
        include: { achievement: true },
      });
      const seenAchievementIds = new Set<string>();
      const achievementColumns: AchievementColumn[] = [];
      for (const question of examQuestions) {
        if (seenAchievementIds.has(question.achievementId)) continue;
        seenAchievementIds.add(question.achievementId);
        achievementColumns.push({
          achievementId: question.achievement.id,
          code: question.achievement.code,
          label: question.achievement.label,
          subject: subjectFromCode(question.achievement.code),
        });
      }

      const studentProfiles = await tx.studentProfile.findMany({
        where: { classroomId },
        include: {
          user: true,
          examResults: {
            where: { examId: exam.id },
            include: { achievementResults: true },
          },
        },
      });

      const students: StudentRow[] = studentProfiles.map((profile) => {
        const examResult = profile.examResults[0];
        const cells = (examResult?.achievementResults ?? []).map((result) => ({
          achievementId: result.achievementId,
          studentId: profile.id,
          masteryLevel: ratioToMastery(result.correctRatio),
          correctRatio: result.correctRatio,
          questionCount: result.questionCount,
        }));
        return {
          studentId: profile.id,
          fullName: `${profile.user.firstName} ${profile.user.lastName}`,
          overallNet: examResult?.netScore ?? 0,
          cells,
        };
      });

      const studentsWithResults = students.filter((s) => s.cells.length > 0);
      const averageNet =
        studentsWithResults.length > 0
          ? Number(
              (studentsWithResults.reduce((sum, s) => sum + s.overallNet, 0) / studentsWithResults.length).toFixed(1),
            )
          : 0;

      const achievementAverages = achievementColumns.map((achievement) => {
        const ratios = studentsWithResults.flatMap((s) =>
          s.cells.filter((c) => c.achievementId === achievement.achievementId).map((c) => c.correctRatio),
        );
        const avg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
        return { achievement, avg };
      });

      const weakest = achievementAverages.reduce(
        (a, b) => (b.avg < a.avg ? b : a),
        achievementAverages[0],
      );
      const strongest = achievementAverages.reduce(
        (a, b) => (b.avg > a.avg ? b : a),
        achievementAverages[0],
      );

      return {
        examId: exam.id,
        examName: exam.name,
        classroomId: classroom.id,
        classroomName: classroom.name,
        generatedAt: new Date().toISOString(),
        achievementColumns,
        students,
        classSummary: {
          averageNet,
          weakestAchievement: {
            achievementId: weakest?.achievement.achievementId ?? "",
            label: weakest?.achievement.label ?? "",
            classAverageRatio: Number((weakest?.avg ?? 0).toFixed(2)),
          },
          strongestAchievement: {
            achievementId: strongest?.achievement.achievementId ?? "",
            label: strongest?.achievement.label ?? "",
            classAverageRatio: Number((strongest?.avg ?? 0).toFixed(2)),
          },
        },
      };
    },
  );

  if (!data) {
    return NextResponse.json({ message: "Sınav veya sınıf bulunamadı" }, { status: 404 });
  }

  return NextResponse.json(data);
}
