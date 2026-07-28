import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Quiz / Pratik Modülü — demo'daki "student:quiz" ekranının karşılığı.
 * `QuizAttempt` yalnızca düz `tenant_isolation` taşır (bkz.
 * prisma/schema.prisma'daki not) — Devamsızlık/Disiplin/PTA ile aynı desen.
 * Yetki kontrolü de birebir aynı: STUDENT kendi, PARENT velisi olduğu
 * öğrencinin denemelerini görebilir/oluşturabilir; personel yalnızca
 * görüntüleyebilir (demo'da personel tarafına özel bir Quiz ekranı yoktur,
 * ama diğer modüllerle tutarlılık için salt okunur erişim tanınır).
 */
async function authorizeSelfOrGuardian(
  tx: any,
  actor: { id: string; role: UserRole },
  student: { id: string },
): Promise<"ok" | "forbidden"> {
  if (actor.role === UserRole.STUDENT) {
    const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
    return ownProfile?.id === student.id ? "ok" : "forbidden";
  }
  if (actor.role === UserRole.PARENT) {
    const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
    const guardianRow = parentProfile
      ? await tx.studentGuardian.findUnique({
          where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
        })
      : null;
    return guardianRow ? "ok" : "forbidden";
  }
  return "forbidden";
}

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT || actor.role === UserRole.PARENT) {
      const auth = await authorizeSelfOrGuardian(tx, actor, student);
      if (auth === "forbidden") return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const attempts = await tx.quizAttempt.findMany({
      where: { studentId: student.id },
      include: { achievement: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      kind: "ok" as const,
      attempts: attempts.map((a) => ({
        id: a.id,
        subject: a.subject,
        achievementCode: a.achievement?.code ?? null,
        achievementLabel: a.achievement?.label ?? null,
        correctCount: a.correctCount,
        totalCount: a.totalCount,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin quiz denemelerini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca öğrenci/veli quiz denemesi kaydedebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const achievementId = typeof body.achievementId === "string" && body.achievementId ? body.achievementId : null;
  const totalCount = Number.isInteger(body.totalCount) ? body.totalCount : null;
  const correctCount = Number.isInteger(body.correctCount) ? body.correctCount : null;

  if (!subject || totalCount === null || correctCount === null || totalCount < 1 || totalCount > 20) {
    return NextResponse.json(
      { message: "subject, totalCount (1-20) ve correctCount zorunludur" },
      { status: 400 },
    );
  }
  if (correctCount < 0 || correctCount > totalCount) {
    return NextResponse.json({ message: "correctCount, 0 ile totalCount arasında olmalıdır" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    const auth = await authorizeSelfOrGuardian(tx, actor, student);
    if (auth === "forbidden") return { kind: "forbidden" as const };

    if (achievementId) {
      const achievement = await tx.curriculumNode.findUnique({ where: { id: achievementId } });
      if (!achievement) return { kind: "achievement_not_found" as const };
    }

    const attempt = await tx.quizAttempt.create({
      data: {
        tenantId: actor.tenantId!,
        studentId: student.id,
        subject,
        achievementId,
        correctCount,
        totalCount,
      },
    });
    return { kind: "created" as const, attempt };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Yalnızca kendi (veya velisi olduğunuz) hesabınız için deneme kaydedebilirsiniz" }, { status: 403 });
  }
  if (outcome.kind === "achievement_not_found") {
    return NextResponse.json({ message: "Kazanım bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ attempt: outcome.attempt }, { status: 201 });
}
