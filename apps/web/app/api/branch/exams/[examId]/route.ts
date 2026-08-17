import { NextRequest, NextResponse } from "next/server";
import { ExamScope, GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";
import { EXAM_ELIGIBLE_GRADE_LEVELS } from "@/lib/grade-tier";
import { actorLabel, logActivity } from "@/lib/audit-log";

const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
// Sınav Uygulaması'nı oluşturan roldür — düzenleme/silme de aynı yetkiye
// tabi (bkz. app/api/branch/exams route.ts CREATE_ROLES).
const MANAGE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav detayını görüntüleyemez" }, { status: 403 });
  }

  const exam = await withBranchTenantContext(actor, (tx) =>
    tx.exam.findUnique({
      where: { id: params.examId },
      include: { questions: { orderBy: { orderIndex: "asc" }, include: { achievement: true } } },
    }),
  );

  if (!exam) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      examDate: exam.examDate.toISOString().slice(0, 10),
      bookletTypes: exam.bookletTypes,
      feePerStudent: exam.feePerStudent ? Number(exam.feePerStudent) : null,
      eligibleGradeLevels: exam.eligibleGradeLevels,
      questions: exam.questions.map((q) => ({
        id: q.id,
        orderIndex: q.orderIndex,
        achievementId: q.achievementId,
        achievementCode: q.achievement.code,
        achievementLabel: q.achievement.label,
        subject: subjectFromCode(q.achievement.code),
        correctAnswer: q.correctAnswer,
      })),
    },
  });
}

/**
 * Sınav Uygulaması düzenleme (task #92) — demo'daki eksikliğin karşılığı.
 * Yalnızca ÜST DÜZEY alanlar (ad/tarih/tür/kitapçık sayısı/ücret/sınıf
 * kapsamı) değiştirilebilir; sorular/cevap anahtarı BURADAN düzenlenemez —
 * zaten girilmiş ExamResult/ExamResultAnswer kayıtlarının tutarlılığını
 * bozmamak için kasıtlı bir sınır (yeni soru seti için yeni sınav oluşturmak
 * gerekir, aynı sınav sonuçlar geldikten sonra "geriye dönük" değişmez).
 */
export async function PATCH(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav uygulamasını düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  const examDate = typeof body.examDate === "string" && !isNaN(Date.parse(body.examDate)) ? new Date(body.examDate) : undefined;
  const hasBookletChange = "bookletCount" in body;
  const bookletCount = body.bookletCount === 2 ? 2 : 4;
  const hasFeeChange = "feePerStudent" in body;
  const feePerStudent = typeof body.feePerStudent === "number" && body.feePerStudent >= 0 ? body.feePerStudent : null;
  const hasGradeChange = "eligibleGradeLevels" in body;
  const eligibleGradeLevels: GradeLevel[] = Array.isArray(body.eligibleGradeLevels)
    ? body.eligibleGradeLevels.filter((g: unknown): g is GradeLevel => typeof g === "string" && EXAM_ELIGIBLE_GRADE_LEVELS.includes(g as GradeLevel))
    : [];

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam || exam.tenantId !== effectiveTenantId(actor) || exam.scope !== ExamScope.BRANCH) return { kind: "not_found" as const };

    const updated = await tx.exam.update({
      where: { id: exam.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(examDate !== undefined ? { examDate } : {}),
        ...(hasBookletChange ? { bookletTypes: bookletCount === 2 ? ["A", "B"] : ["A", "B", "C", "D"] } : {}),
        ...(hasFeeChange ? { feePerStudent } : {}),
        ...(hasGradeChange ? { eligibleGradeLevels } : {}),
      },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Sınav uygulaması düzenlendi",
      detail: updated.name,
    });

    return { kind: "updated" as const, exam: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
    exam: {
      id: outcome.exam.id,
      name: outcome.exam.name,
      type: outcome.exam.type,
      examDate: outcome.exam.examDate.toISOString().slice(0, 10),
      bookletTypes: outcome.exam.bookletTypes,
      feePerStudent: outcome.exam.feePerStudent ? Number(outcome.exam.feePerStudent) : null,
      eligibleGradeLevels: outcome.exam.eligibleGradeLevels,
    },
  });
}

/**
 * Sınav Uygulaması silme (task #92). `ExamResult` (bkz. schema.prisma)
 * `onDelete: Cascade` DEĞİLDİR — bir öğrenciye ait tek bir sonuç bile
 * girilmişse silme 409 ile reddedilir (aksi halde sonuçlar sessizce
 * kaybolurdu). Sorular (`ExamQuestion`) cascade'dir, ayrıca silinmesine
 * gerek yoktur.
 */
export async function DELETE(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav uygulamasını silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId }, include: { _count: { select: { results: true } } } });
    if (!exam || exam.tenantId !== effectiveTenantId(actor) || exam.scope !== ExamScope.BRANCH) return { kind: "not_found" as const };
    if (exam._count.results > 0) return { kind: "has_results" as const };

    await tx.exam.delete({ where: { id: exam.id } });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Sınav uygulaması silindi",
      detail: exam.name,
    });

    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "has_results") {
    return NextResponse.json({ message: "Bu sınava ait girilmiş sonuçlar olduğu için silinemez." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
