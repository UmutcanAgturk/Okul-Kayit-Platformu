import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Ölçme-Değerlendirme — Sonuç Girişi. demo/seviye360-app.html'deki
 * "Optikleri Yükle" akışının (renderOptikRosterStage/runOptikScanForStudent)
 * karşılığı — TEK FARKLA: demo, yüklenen "optik form" görselini gerçekte
 * OKUMAZ, rastgele doğru/yanlış/boş üretir (bkz. runOptikScanForStudent).
 * Burada UYDURMA veri üretilmez (bkz. kök README.md "veri zaten gerçek"
 * ilkesi) — bunun yerine her soru için gerçek Doğru/Yanlış/Boş işaretlemesi
 * elle girilir (kamera/mobil OCR bu depoda kasıtlı olarak kapsam dışıdır).
 * Net puan = doğru - yanlış/4 (4 seçenekli çoktan seçmeli standart formülü).
 *
 * TEACHER da sonuç girebilir (demo'da öğretmen kendi sınıfının optiğini
 * yüklüyordu) — ama yalnızca KENDİ Ders Programı'nda (TimetableSlot) yer
 * alan sınıflar için; assertTeacherOwnsClassroom bunu doğrular.
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const ENTER_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];

async function teacherOwnsClassroom(tx: { teacherProfile: { findUnique: Function }; timetableSlot: { findFirst: Function } }, teacherUserId: string, classroomId: string) {
  const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: teacherUserId } });
  if (!teacherProfile) return false;
  const slot = await tx.timetableSlot.findFirst({ where: { teacherId: teacherProfile.id, classroomId } });
  return !!slot;
}

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sonuç girişini görüntüleyemez" }, { status: 403 });
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId");
  if (!classroomId) {
    return NextResponse.json({ message: "classroomId zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam) return null;
    const students = await tx.studentProfile.findMany({
      where: { classroomId },
      include: { user: true, examResults: { where: { examId: params.examId } } },
      orderBy: { user: { firstName: "asc" } },
    });
    return {
      roster: students.map((s) => ({
        studentId: s.id,
        studentNo: s.studentNo,
        name: `${s.user.firstName} ${s.user.lastName}`,
        hasResult: s.examResults.length > 0,
        netScore: s.examResults[0]?.netScore ?? null,
      })),
    };
  });

  if (!outcome) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(outcome);
}

export async function POST(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ENTER_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sonuç giremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  const rawAnswers: unknown[] | null = Array.isArray(body.answers) ? body.answers : null;
  const answers: { questionId: string; isCorrect: boolean | null }[] | null = rawAnswers
    ? rawAnswers.filter(
        (a): a is { questionId: string; isCorrect: boolean | null } =>
          typeof a === "object" && a !== null && typeof (a as { questionId?: unknown }).questionId === "string" &&
          ((a as { isCorrect?: unknown }).isCorrect === true || (a as { isCorrect?: unknown }).isCorrect === false || (a as { isCorrect?: unknown }).isCorrect === null),
      )
    : null;

  if (!studentId || !answers) {
    return NextResponse.json({ message: "studentId ve answers (questionId + isCorrect) zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId }, include: { questions: true } });
    if (!exam) return { kind: "exam_not_found" as const };

    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) return { kind: "student_not_found" as const };

    if (actor.role === UserRole.TEACHER) {
      const ownsClassroom = student.classroomId && (await teacherOwnsClassroom(tx, actor.id, student.classroomId));
      if (!ownsClassroom) return { kind: "not_own_classroom" as const };
    }

    const questionIds = new Set(exam.questions.map((q) => q.id));
    if (answers.length !== exam.questions.length || answers.some((a) => !questionIds.has(a.questionId))) {
      return { kind: "answer_mismatch" as const };
    }

    const correctCount = answers.filter((a) => a.isCorrect === true).length;
    const wrongCount = answers.filter((a) => a.isCorrect === false).length;
    const emptyCount = answers.filter((a) => a.isCorrect === null).length;
    const netScore = Number((correctCount - wrongCount / 4).toFixed(2));
    const rawScore = Number(((correctCount / exam.questions.length) * 100).toFixed(2));

    const byAchievement = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const question = exam.questions.find((q) => q.id === a.questionId)!;
      const bucket = byAchievement.get(question.achievementId) ?? { total: 0, correct: 0 };
      bucket.total += 1;
      if (a.isCorrect === true) bucket.correct += 1;
      byAchievement.set(question.achievementId, bucket);
    }

    const examResult = await tx.examResult.upsert({
      where: { examId_studentId: { examId: exam.id, studentId } },
      create: { examId: exam.id, tenantId: effectiveTenantId(actor), studentId, correctCount, wrongCount, emptyCount, rawScore, netScore },
      update: { correctCount, wrongCount, emptyCount, rawScore, netScore },
    });

    await tx.studentAchievementResult.deleteMany({ where: { examResultId: examResult.id } });
    await tx.studentAchievementResult.createMany({
      data: [...byAchievement.entries()].map(([achievementId, v]) => ({
        examResultId: examResult.id,
        studentId,
        achievementId,
        questionCount: v.total,
        correctCount: v.correct,
        correctRatio: v.correct / v.total,
      })),
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Sınav sonucu girildi",
      detail: `${exam.name} — ${student.studentNo} (net ${netScore})`,
    });

    return { kind: "ok" as const, examResult, netScore, correctCount, wrongCount, emptyCount };
  });

  if (outcome.kind === "exam_not_found") {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "student_not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "not_own_classroom") {
    return NextResponse.json({ message: "Yalnızca kendi Ders Programınızda yer alan sınıflar için sonuç girebilirsiniz" }, { status: 403 });
  }
  if (outcome.kind === "answer_mismatch") {
    return NextResponse.json({ message: "answers, sınavdaki tüm sorular için tam olarak bir kez girilmelidir" }, { status: 400 });
  }
  return NextResponse.json({
    correctCount: outcome.correctCount,
    wrongCount: outcome.wrongCount,
    emptyCount: outcome.emptyCount,
    netScore: outcome.netScore,
  });
}
