import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";
import { aiEnabled, readOpticSheet } from "@/lib/anthropic";

/**
 * Mobil Optik Okuyucu (OMR) — SADECE mobil uygulamada arayüzü olan gerçek
 * görsel optik okuma. Öğretmen, cevap kağıdının fotoğrafını çeker; bu endpoint
 * Anthropic (Claude) görü modeliyle (bkz. lib/anthropic.readOpticSheet)
 * işaretli şıkları okur, `ExamQuestion.correctAnswer` cevap anahtarıyla
 * karşılaştırıp Doğru/Yanlış/Boş üretir ve Sonuç Girişi ile BİREBİR aynı
 * kayıt mantığını (examResult upsert + kazanım + soru bazlı + audit + bildirim)
 * çalıştırır. Elle giriş (bkz. .../results) yerine kamerayı ikame eder.
 *
 * ANTHROPIC_API_KEY tanımlı DEĞİLSE 503 döner — mobil arayüz bu durumda
 * kullanıcıyı elle Sonuç Girişi'ne yönlendirir.
 */
const ENTER_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];

async function teacherOwnsClassroom(
  tx: { teacherProfile: { findUnique: Function }; timetableSlot: { findFirst: Function } },
  teacherUserId: string,
  classroomId: string,
) {
  const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: teacherUserId } });
  if (!teacherProfile) return false;
  const slot = await tx.timetableSlot.findFirst({ where: { teacherId: teacherProfile.id, classroomId } });
  return !!slot;
}

export async function POST(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ENTER_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol optik form yükleyemez" }, { status: 403 });
  }
  if (!aiEnabled()) {
    return NextResponse.json(
      { message: "Optik okuma için AI (ANTHROPIC_API_KEY) yapılandırılmamış. Sonucu Sonuç Girişi'nden elle girebilirsiniz." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  const imageBase64 = typeof body.imageBase64 === "string" && body.imageBase64 ? body.imageBase64 : null;
  const mediaType = typeof body.mediaType === "string" && /^image\/(jpeg|png|webp|gif)$/.test(body.mediaType) ? body.mediaType : "image/jpeg";
  const bookletType = typeof body.bookletType === "string" && body.bookletType.trim() ? body.bookletType.trim() : null;
  if (!studentId || !imageBase64) {
    return NextResponse.json({ message: "studentId ve imageBase64 zorunludur" }, { status: 400 });
  }

  // Cevap anahtarını ve kimlik/yetki kontrolünü DB tx içinde topla — görsel
  // okuma (ağ) işlemini tx DIŞINDA yaparız (tx'i model gecikmesiyle tutmayalım).
  const prep = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId }, include: { questions: { orderBy: { orderIndex: "asc" } } } });
    if (!exam) return { kind: "exam_not_found" as const };
    if (bookletType && !exam.bookletTypes.includes(bookletType)) return { kind: "bad_booklet_type" as const };
    if (exam.questions.length === 0) return { kind: "no_questions" as const };

    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) return { kind: "student_not_found" as const };
    if (exam.eligibleGradeLevels.length > 0 && !exam.eligibleGradeLevels.includes(student.gradeLevel)) {
      return { kind: "grade_not_eligible" as const };
    }
    if (actor.role === UserRole.TEACHER) {
      const owns = student.classroomId && (await teacherOwnsClassroom(tx, actor.id, student.classroomId));
      if (!owns) return { kind: "not_own_classroom" as const };
    }
    return {
      kind: "ready" as const,
      examName: exam.name,
      questions: exam.questions.map((q) => ({ id: q.id, achievementId: q.achievementId, correctAnswer: (q.correctAnswer ?? "").trim().toUpperCase() })),
    };
  });

  if (prep.kind === "exam_not_found") return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  if (prep.kind === "bad_booklet_type") return NextResponse.json({ message: "Geçersiz kitapçık türü" }, { status: 400 });
  if (prep.kind === "no_questions") return NextResponse.json({ message: "Bu sınavın soru/cevap anahtarı tanımlı değil" }, { status: 400 });
  if (prep.kind === "student_not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  if (prep.kind === "grade_not_eligible") return NextResponse.json({ message: "Bu öğrencinin sınıf düzeyi sınav kapsamında değil" }, { status: 400 });
  if (prep.kind === "not_own_classroom") return NextResponse.json({ message: "Yalnızca kendi Ders Programınızda yer alan sınıflar için optik yükleyebilirsiniz" }, { status: 403 });
  if (!prep.questions.some((q) => q.correctAnswer)) {
    return NextResponse.json({ message: "Bu sınavın cevap anahtarı girilmemiş. Optik okuma için önce cevap anahtarını tanımlayın." }, { status: 400 });
  }

  // --- AI görsel okuma (tx dışı) ---
  const read = await readOpticSheet(imageBase64, mediaType, prep.questions.length);
  if (!read) {
    return NextResponse.json({ message: "Optik form okunamadı. Fotoğrafın net, dik ve iyi aydınlatılmış olduğundan emin olup tekrar deneyin." }, { status: 422 });
  }

  // Okunan şıkları cevap anahtarıyla karşılaştır → Doğru/Yanlış/Boş.
  const answers = prep.questions.map((q, i) => {
    const marked = (read[i] ?? "").toUpperCase();
    if (!marked) return { questionId: q.id, achievementId: q.achievementId, isCorrect: null as boolean | null };
    if (!q.correctAnswer) return { questionId: q.id, achievementId: q.achievementId, isCorrect: null as boolean | null };
    return { questionId: q.id, achievementId: q.achievementId, isCorrect: marked === q.correctAnswer };
  });

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam) return { kind: "exam_not_found" as const };
    const student = await tx.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true, guardians: { include: { parent: { include: { user: true } } } } },
    });
    if (!student) return { kind: "student_not_found" as const };

    const correctCount = answers.filter((a) => a.isCorrect === true).length;
    const wrongCount = answers.filter((a) => a.isCorrect === false).length;
    const emptyCount = answers.filter((a) => a.isCorrect === null).length;
    const netScore = Number((correctCount - wrongCount / 4).toFixed(2));
    const rawScore = Number(((correctCount / answers.length) * 100).toFixed(2));

    const byAchievement = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const bucket = byAchievement.get(a.achievementId) ?? { total: 0, correct: 0 };
      bucket.total += 1;
      if (a.isCorrect === true) bucket.correct += 1;
      byAchievement.set(a.achievementId, bucket);
    }

    const examResult = await tx.examResult.upsert({
      where: { examId_studentId: { examId: exam.id, studentId } },
      create: { examId: exam.id, tenantId: effectiveTenantId(actor), studentId, correctCount, wrongCount, emptyCount, rawScore, netScore, bookletType },
      update: { correctCount, wrongCount, emptyCount, rawScore, netScore, bookletType },
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

    await tx.examResultAnswer.deleteMany({ where: { examResultId: examResult.id } });
    await tx.examResultAnswer.createMany({
      data: answers.map((a) => ({ examResultId: examResult.id, questionId: a.questionId, isCorrect: a.isCorrect })),
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Optik form okundu (AI)",
      detail: `${exam.name} — ${student.studentNo} (net ${netScore})`,
    });

    const billing = student.guardians.find((g) => g.isBillingResponsible) ?? student.guardians[0];
    const contact = billing ? billing.parent.user : student.user;
    return {
      kind: "ok" as const,
      netScore, correctCount, wrongCount, emptyCount,
      notifyTarget: { userId: contact.id, phone: contact.phone, email: contact.email, name: contact.firstName },
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      examName: exam.name,
    };
  });

  if (outcome.kind === "exam_not_found") return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  if (outcome.kind === "student_not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });

  void notify(outcome.notifyTarget, {
    sms: `Sn. ${outcome.notifyTarget.name}, ${outcome.studentName} icin ${outcome.examName} sonucu aciklandi. Net: ${outcome.netScore} (D:${outcome.correctCount} Y:${outcome.wrongCount} B:${outcome.emptyCount}). Seviye 360`,
    emailSubject: `Sınav Sonucu: ${outcome.examName} — Seviye 360`,
    emailText: `Sayın ${outcome.notifyTarget.name},\n\n${outcome.studentName} adına ${outcome.examName} sınav sonucu açıklanmıştır.\nNet: ${outcome.netScore}  (Doğru: ${outcome.correctCount}, Yanlış: ${outcome.wrongCount}, Boş: ${outcome.emptyCount})\n\nSeviye 360 Eğitim Kurumları`,
  }).catch(() => {});
  void sendPushToUser(outcome.notifyTarget.userId, `Sınav Sonucu: ${outcome.examName}`, `${outcome.studentName} — Net ${outcome.netScore} (D:${outcome.correctCount} Y:${outcome.wrongCount} B:${outcome.emptyCount})`, { type: "exam-result" }).catch(() => {});

  return NextResponse.json({
    correctCount: outcome.correctCount,
    wrongCount: outcome.wrongCount,
    emptyCount: outcome.emptyCount,
    netScore: outcome.netScore,
    readAnswers: read,
  });
}
