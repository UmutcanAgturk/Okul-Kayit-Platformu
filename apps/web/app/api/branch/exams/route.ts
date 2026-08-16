import { NextRequest, NextResponse } from "next/server";
import { ExamScope, ExamType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Ölçme-Değerlendirme — Sınav Uygulaması. demo/seviye360-app.html'deki
 * SCREENS["branch:olcme"] > "Sınav Uygulaması" sekmesinin (SINAV_UYGULAMALARI)
 * gerçek karşılığı: Exam(scope=BRANCH) + ExamQuestion (her soru bir
 * CurriculumNode kazanımına bağlanır). Şema (Exam.scope BRANCH/NETWORK,
 * ExamQuestion) baştan beri vardı ama BRANCH kapsamlı hiçbir sınav
 * oluşturan bir route yoktu — bu, Sonuç Girişi (bkz.
 * app/api/branch/exams/[examId]/results) ve dolayısıyla Karne/Yol
 * Haritası/AI Sınıf Röntgeni/Öğretmen Performansı'nın GERÇEK veriyle
 * beslenebilmesinin tek girdi noktasıdır.
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const CREATE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav listesini görüntüleyemez" }, { status: 403 });
  }

  const exams = await withBranchTenantContext(actor, async (tx) => {
    const rows = await tx.exam.findMany({
      where: { scope: ExamScope.BRANCH },
      orderBy: { examDate: "desc" },
      include: { _count: { select: { questions: true, results: true } }, results: { select: { netScore: true } } },
    });
    return rows.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      examDate: e.examDate.toISOString().slice(0, 10),
      questionCount: e._count.questions,
      resultCount: e._count.results,
      avgNet: e.results.length > 0 ? Number((e.results.reduce((s, r) => s + r.netScore, 0) / e.results.length).toFixed(1)) : null,
    }));
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
  const questions: { achievementId: string }[] = rawQuestions.filter(
    (q): q is { achievementId: string } => typeof q === "object" && q !== null && typeof (q as { achievementId?: unknown }).achievementId === "string",
  );

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
        questions: {
          create: questions.map((q, i) => ({ orderIndex: i + 1, achievementId: q.achievementId })),
        },
      },
      include: { questions: true },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Sınav uygulaması oluşturuldu",
      detail: `${exam.name} — ${exam.questions.length} soru`,
    });

    return { kind: "created" as const, exam };
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
        questionCount: outcome.exam.questions.length,
      },
    },
    { status: 201 },
  );
}
