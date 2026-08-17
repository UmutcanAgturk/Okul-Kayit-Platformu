import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { ratioToMastery, subjectFromCode } from "@/lib/curriculum";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Öğrenci/Veli — "Sınav Sonuçlarım". demo/seviye360-app.html'deki
 * SCREENS["student:olcme"] > "ai" sekmesinin (öğrenci portalında "Sınav
 * Sonuçlarım" olarak yeniden etiketlenen, renderAiResultHtml) karşılığı.
 * Karne (report-card) TÜM sınavlar üzerinden birleştirilmiş bir özet
 * gösterir; bu route ise demo'daki gibi TEK bir sınava odaklanabilen
 * (doğru/yanlış/boş + kazanım kırılımı) ve kazanım bazlı çok-sınavlı bir
 * trend (sparkline) sunan, Karne'den ayrı bir görünüm sağlar.
 *
 * questionBreakdown: demo'daki "Soru Bazlı Değerlendirme" tablosunun
 * karşılığı (ExamResultAnswer, bkz. app/api/branch/exams/[examId]/results
 * POST) — demo'nun kendisinden TEK farkla: demo, öğrencinin işaretlediği
 * şıkkı ("given") RASTGELE üretiyordu (bkz. simulateAnswerSheet); kamera/OCR
 * bazlı otomatik okuma bu depoda kasıtlı olarak kapsam dışı olduğundan burada
 * UYDURMA bir "given" alanı YOKTUR — yalnızca gerçekten elle girilen
 * Doğru/Yanlış/Boş sonucu ve gerçek cevap anahtarı (ExamQuestion.correctAnswer)
 * gösterilir. Yetki kontrolü Karne ile birebir aynıdır.
 *
 * peerComparison (task #111): demo'daki buildStudentAiProfile'ın comparison
 * hesabıyla AYNI fikir (kendi sınıfındaki AYNI sınava giren akranlarının
 * ortalama neti) — demo'nun kendisi bunu yalnızca şube/öğretmen tarafındaki
 * öğrenci çekmecesinde gösteriyordu, öğrencinin KENDİ "Sınav Sonuçlarım"
 * self-servis görünümünde hiç yoktu; bu, o eksikliği kapatır. Öğrenci RLS
 * altında başka öğrencilerin ExamResult'una asla doğrudan erişemeyeceğinden
 * bu hesap MUTLAKA backend'de yapılmalı — istemci tarafı yalnızca anlatı
 * (narrative) metnini üretir (bkz. ExamResultsView.tsx, task #102'deki
 * DurumAiSummaryCard ile aynı "yeni endpoint gerektirmeyen kural-tabanlı
 * metin" deseni). classroomId'si olmayan (henüz sınıfa atanmamış) veya
 * sınıfında aynı sınava giren başka kimse olmayan öğrenciler için null döner.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const examResults = await tx.examResult.findMany({
      where: { studentId: student.id },
      include: {
        exam: true,
        achievementResults: { include: { achievement: true } },
        answers: { include: { question: { include: { achievement: true } } } },
      },
      orderBy: { exam: { examDate: "desc" } },
    });

    const examHistory = await Promise.all(
      examResults.map(async (r) => {
        let peerComparison: { peerAvgNet: number; diff: number; peerCount: number } | null = null;
        if (student.classroomId) {
          const peers = await tx.examResult.findMany({
            where: { examId: r.examId, studentId: { not: student.id }, student: { classroomId: student.classroomId } },
            select: { netScore: true },
          });
          if (peers.length > 0) {
            const peerAvgNet = Number((peers.reduce((sum, p) => sum + p.netScore, 0) / peers.length).toFixed(2));
            peerComparison = { peerAvgNet, diff: Number((r.netScore - peerAvgNet).toFixed(2)), peerCount: peers.length };
          }
        }

        return {
          examId: r.examId,
          examName: r.exam.name,
          examType: r.exam.type,
          examDate: r.exam.examDate.toISOString().slice(0, 10),
          netScore: r.netScore,
          rawScore: r.rawScore,
          correctCount: r.correctCount,
          wrongCount: r.wrongCount,
          emptyCount: r.emptyCount,
          peerComparison,
          achievementBreakdown: r.achievementResults
            .map((a) => ({
              achievementId: a.achievementId,
              code: a.achievement.code,
              label: a.achievement.label,
              subject: subjectFromCode(a.achievement.code),
              correctRatio: a.correctRatio,
              masteryLevel: ratioToMastery(a.correctRatio),
            }))
            .sort((a, b) => a.correctRatio - b.correctRatio),
          questionBreakdown: r.answers
            .map((a) => ({
              questionNo: a.question.orderIndex,
              subject: subjectFromCode(a.question.achievement.code),
              achievementLabel: a.question.achievement.label,
              correctAnswer: a.question.correctAnswer,
              isCorrect: a.isCorrect,
            }))
            .sort((a, b) => a.questionNo - b.questionNo),
        };
      }),
    );

    // Kazanım bazlı çok-sınavlı trend (demo'daki achievementTrend/sparkline) —
    // her kazanım için, o kazanımın sorulduğu sınavlar boyunca (kronolojik)
    // correctRatio dizisi.
    const byAchievement = new Map<
      string,
      { code: string; label: string; subject: string; points: { examName: string; examDate: string; correctRatio: number }[] }
    >();
    for (const r of [...examResults].reverse()) {
      for (const a of r.achievementResults) {
        const bucket = byAchievement.get(a.achievementId) ?? {
          code: a.achievement.code,
          label: a.achievement.label,
          subject: subjectFromCode(a.achievement.code),
          points: [],
        };
        bucket.points.push({ examName: r.exam.name, examDate: r.exam.examDate.toISOString().slice(0, 10), correctRatio: a.correctRatio });
        byAchievement.set(a.achievementId, bucket);
      }
    }
    const achievementTrend = [...byAchievement.entries()]
      .filter(([, v]) => v.points.length >= 2)
      .map(([achievementId, v]) => ({ achievementId, ...v }))
      .sort((a, b) => a.points[a.points.length - 1].correctRatio - b.points[b.points.length - 1].correctRatio);

    return {
      kind: "ok" as const,
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      examHistory,
      achievementTrend,
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin sınav sonuçlarını görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
