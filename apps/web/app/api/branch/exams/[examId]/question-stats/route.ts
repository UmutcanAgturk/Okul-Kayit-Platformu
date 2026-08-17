import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * "Sınav Bazlı Soru/Madde Analizi" — demo'daki examQuestionStats()'ın gerçek
 * karşılığı (bkz. Ölçme-Değerlendirme > Durum sekmesi). Seçili sınavda tüm
 * öğrenciler genelinde en çok yanlış/boş bırakılan soruları (madde bazlı
 * zorluk analizi) döndürür — ExamResultAnswer'ın (bkz. task #75, Sonuç
 * Girişi'nde artık her soru için gerçekten kaydedilen Doğru/Yanlış/Boş
 * sonucu) kurum genelinde toplandığı ilk yer.
 *
 * ExamResultAnswer'da tenantId YOKTUR (StudentAchievementResult ile aynı
 * desen) — bu yüzden ÖNCE exam, RLS korumalı tx.exam.findUnique ile
 * doğrulanır (tenant'a ait değilse null döner); ardından yalnızca O sınava
 * ait sorulara bağlı cevaplar sorgulanır — questionId, ExamQuestion.examId
 * üzerinden zaten bu doğrulanmış sınava sabitlenmiş olduğundan çapraz-tenant
 * sızıntısı mümkün değildir.
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol soru analizini görüntüleyemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id: params.examId },
      include: { questions: { orderBy: { orderIndex: "asc" }, include: { achievement: true } } },
    });
    if (!exam) return { kind: "not_found" as const };

    const answers = await tx.examResultAnswer.findMany({
      where: { question: { examId: exam.id } },
      select: { questionId: true, isCorrect: true },
    });

    const byQuestion = new Map<string, { correct: number; wrong: number; blank: number; total: number }>();
    for (const a of answers) {
      const bucket = byQuestion.get(a.questionId) ?? { correct: 0, wrong: 0, blank: 0, total: 0 };
      bucket.total += 1;
      if (a.isCorrect === true) bucket.correct += 1;
      else if (a.isCorrect === false) bucket.wrong += 1;
      else bucket.blank += 1;
      byQuestion.set(a.questionId, bucket);
    }

    const questions = exam.questions.map((q) => {
      const stats = byQuestion.get(q.id) ?? { correct: 0, wrong: 0, blank: 0, total: 0 };
      return {
        questionId: q.id,
        questionNo: q.orderIndex,
        subject: subjectFromCode(q.achievement.code),
        achievementLabel: q.achievement.label,
        correct: stats.correct,
        wrong: stats.wrong,
        blank: stats.blank,
        total: stats.total,
        wrongPct: stats.total ? Math.round(((stats.wrong + stats.blank) / stats.total) * 100) : 0,
      };
    });

    return { kind: "ok" as const, questions };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ questions: outcome.questions });
}
