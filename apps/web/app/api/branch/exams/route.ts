import { NextRequest, NextResponse } from "next/server";
import { ExamScope, ExamType, GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { EXAM_ELIGIBLE_GRADE_LEVELS } from "@/lib/grade-tier";

/**
 * Ölçme-Değerlendirme — Sınav Uygulaması. demo/seviye360-app.html'deki
 * SCREENS["branch:olcme"] > "Sınav Uygulaması" sekmesinin (SINAV_UYGULAMALARI)
 * gerçek karşılığı: Exam(scope=BRANCH) + ExamQuestion (her soru bir
 * CurriculumNode kazanımına bağlanır, ayrıca demo'daki gibi bir cevap
 * anahtarı harfi taşıyabilir). Şema (Exam.scope BRANCH/NETWORK,
 * ExamQuestion) baştan beri vardı ama BRANCH kapsamlı hiçbir sınav
 * oluşturan bir route yoktu — bu, Sonuç Girişi (bkz.
 * app/api/branch/exams/[examId]/results) ve dolayısıyla Karne/Yol
 * Haritası/AI Sınıf Röntgeni/Öğretmen Performansı'nın GERÇEK veriyle
 * beslenebilmesinin tek girdi noktasıdır.
 *
 * Kitapçık sayısı/ücret/sınıf düzeyi kapsamı demo'daki "Sınav Kapsamı"
 * bölümüyle birebir aynı (bkz. su-booklet/su-fee/su-grade-cb) — HQ'nun
 * "Genel Sınav Merkezi"nden (bkz. app/api/hq/exams) FARKLI olarak burada
 * şube seçimi YOK (BRANCH sınavı zaten tek tenant'a sabit) ve
 * eligibleGradeLevels boş bırakılırsa (varsayılan) TÜM sınıf düzeyleri dahil
 * kabul edilir.
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const CREATE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const ANSWER_KEY_OPTIONS = ["A", "B", "C", "D", "E"];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav listesini görüntüleyemez" }, { status: 403 });
  }

  const exams = await withBranchTenantContext(actor, async (tx) => {
    // Katılım oranı (%) — "beklenen" payda, sınavın eligibleGradeLevels
    // kapsamı varsa (boş değilse) YALNIZCA o sınıf düzeylerindeki aktif
    // öğrenci sayısı, kapsam boşsa (varsayılan, "Tümü") şubedeki TÜM aktif
    // öğrenci sayısıdır.
    const activeStudentCount = await tx.studentProfile.count({ where: { user: { isActive: true } } });
    const activeStudents = await tx.studentProfile.findMany({ where: { user: { isActive: true } }, select: { gradeLevel: true } });
    const countByGrade = new Map<GradeLevel, number>();
    for (const s of activeStudents) countByGrade.set(s.gradeLevel, (countByGrade.get(s.gradeLevel) ?? 0) + 1);

    const rows = await tx.exam.findMany({
      where: { scope: ExamScope.BRANCH },
      orderBy: { examDate: "desc" },
      include: {
        _count: { select: { questions: true, results: true } },
        results: { select: { netScore: true, correctCount: true, wrongCount: true, emptyCount: true } },
      },
    });
    return rows.map((e) => {
      const totalCorrect = e.results.reduce((s, r) => s + r.correctCount, 0);
      const totalWrong = e.results.reduce((s, r) => s + r.wrongCount, 0);
      const totalEmpty = e.results.reduce((s, r) => s + r.emptyCount, 0);
      const totalAnswers = totalCorrect + totalWrong + totalEmpty;
      const eligibleStudentCount =
        e.eligibleGradeLevels.length > 0
          ? e.eligibleGradeLevels.reduce((sum, g) => sum + (countByGrade.get(g) ?? 0), 0)
          : activeStudentCount;
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        examDate: e.examDate.toISOString().slice(0, 10),
        bookletTypes: e.bookletTypes,
        feePerStudent: e.feePerStudent ? Number(e.feePerStudent) : null,
        eligibleGradeLevels: e.eligibleGradeLevels,
        questionCount: e._count.questions,
        resultCount: e._count.results,
        avgNet: e.results.length > 0 ? Number((e.results.reduce((s, r) => s + r.netScore, 0) / e.results.length).toFixed(1)) : null,
        participationPct: eligibleStudentCount > 0 ? Math.round((e._count.results / eligibleStudentCount) * 100) : null,
        correctCount: totalCorrect,
        wrongCount: totalWrong,
        emptyCount: totalEmpty,
        correctRatePct: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null,
      };
    });
  });

  return NextResponse.json({ exams });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!CREATE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav uygulaması oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const examDate = typeof body.examDate === "string" && !isNaN(Date.parse(body.examDate)) ? new Date(body.examDate) : null;
  const type = typeof body.type === "string" && body.type in ExamType ? (body.type as ExamType) : ExamType.DENEME;
  const rawQuestions: unknown[] = Array.isArray(body.questions) ? body.questions : [];
  const questions: { achievementId: string; correctAnswer: string | null }[] = rawQuestions
    .filter(
      (q): q is { achievementId: string; correctAnswer?: unknown } =>
        typeof q === "object" && q !== null && typeof (q as { achievementId?: unknown }).achievementId === "string",
    )
    .map((q) => ({
      achievementId: q.achievementId,
      correctAnswer: typeof q.correctAnswer === "string" && ANSWER_KEY_OPTIONS.includes(q.correctAnswer) ? q.correctAnswer : null,
    }));
  const bookletCount = body.bookletCount === 2 ? 2 : 4;
  const feePerStudent = typeof body.feePerStudent === "number" && body.feePerStudent >= 0 ? body.feePerStudent : null;
  const eligibleGradeLevels: GradeLevel[] = Array.isArray(body.eligibleGradeLevels)
    ? body.eligibleGradeLevels.filter((g: unknown): g is GradeLevel => typeof g === "string" && EXAM_ELIGIBLE_GRADE_LEVELS.includes(g as GradeLevel))
    : [];

  if (!name || !examDate) {
    return NextResponse.json({ message: "name ve examDate zorunludur" }, { status: 400 });
  }
  if (questions.length === 0) {
    return NextResponse.json({ message: "En az bir soru (achievementId) zorunludur" }, { status: 400 });
  }
  if (questions.length > 100) {
    return NextResponse.json({ message: "Tek seferde en fazla 100 soru eklenebilir" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const achievementIds = [...new Set(questions.map((q) => q.achievementId))];
    const achievements = await tx.curriculumNode.findMany({ where: { id: { in: achievementIds } } });
    if (achievements.length !== achievementIds.length) return { kind: "bad_achievement" as const };

    const exam = await tx.exam.create({
      data: {
        tenantId: effectiveTenantId(actor),
        name,
        type,
        scope: ExamScope.BRANCH,
        examDate,
        bookletTypes: bookletCount === 2 ? ["A", "B"] : ["A", "B", "C", "D"],
        feePerStudent,
        eligibleGradeLevels,
        questions: {
          create: questions.map((q, i) => ({ orderIndex: i + 1, achievementId: q.achievementId, correctAnswer: q.correctAnswer })),
        },
      },
      include: { questions: true },
    });

    const studentCount = await tx.studentProfile.count({
      where: { user: { isActive: true }, ...(eligibleGradeLevels.length > 0 ? { gradeLevel: { in: eligibleGradeLevels } } : {}) },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Sınav uygulaması oluşturuldu",
      detail: `${exam.name} — ${exam.questions.length} soru, ${studentCount} öğrenci kapsamda`,
    });

    return { kind: "created" as const, exam, studentCount };
  });

  if (outcome.kind === "bad_achievement") {
    return NextResponse.json({ message: "Bir veya birden fazla achievementId geçersiz" }, { status: 400 });
  }
  return NextResponse.json(
    {
      exam: {
        id: outcome.exam.id,
        name: outcome.exam.name,
        type: outcome.exam.type,
        examDate: outcome.exam.examDate.toISOString().slice(0, 10),
        bookletTypes: outcome.exam.bookletTypes,
        feePerStudent: outcome.exam.feePerStudent ? Number(outcome.exam.feePerStudent) : null,
        eligibleGradeLevels: outcome.exam.eligibleGradeLevels,
        questionCount: outcome.exam.questions.length,
      },
      studentCount: outcome.studentCount,
    },
    { status: 201 },
  );
}
