import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { BADGE_DEFS, computeStudentGamificationContext, earnedBadges, xpLevelInfo } from "@/lib/gamification";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Başarı Rozetlerim — demo'daki "student:basari" ekranının gerçek karşılığı.
 * Yeni bir Prisma modeli EKLEMEZ, tamamen agregasyondur (bkz. lib/gamification.ts).
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
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

    const ctx = await computeStudentGamificationContext(tx, student.id);
    const level = xpLevelInfo(ctx.xp);
    const badges = earnedBadges(ctx);

    let classRank: number | null = null;
    let classSize = 0;
    if (student.classroomId) {
      const classmates = await tx.studentProfile.findMany({ where: { classroomId: student.classroomId }, select: { id: true } });
      classSize = classmates.length;
      const xps = await Promise.all(classmates.map((c) => computeStudentGamificationContext(tx, c.id).then((c2) => c2.xp)));
      const sorted = classmates.map((c, i) => ({ id: c.id, xp: xps[i] })).sort((a, b) => b.xp - a.xp);
      classRank = sorted.findIndex((c) => c.id === student.id) + 1;
    }

    return {
      kind: "ok" as const,
      xp: ctx.xp,
      level: level.level,
      xpIntoLevel: level.xpIntoLevel,
      xpForNextLevel: level.xpForNextLevel,
      progressPct: level.progressPct,
      classRank,
      classSize,
      stats: {
        examCount: ctx.examCount,
        attRate: ctx.attRate,
        etutJoined: ctx.etutJoined,
        bestNet: ctx.bestNet,
        disciplinePoints: ctx.disciplinePoints,
        clubCount: ctx.clubCount,
        quizAttemptCount: ctx.quizAttemptCount,
      },
      badges: BADGE_DEFS.map((b) => ({ id: b.id, label: b.label, desc: b.desc, earned: badges.some((e) => e.id === b.id) })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin başarı verisini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
