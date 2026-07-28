import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { computeStudentGamificationContext, earnedBadges, xpLevelInfo } from "@/lib/gamification";

/**
 * Lider Tablosu — demo'daki "branch:leaderboard"/"teacher:leaderboard"
 * ekranlarının gerçek karşılığı. Bu depoda gerçek bir öğretmen-sınıf ataması
 * modeli olmadığından (bkz. README'deki "Öğretmen Performans Paneli" notu),
 * TEACHER de Devamsızlık/Disiplin ile aynı şekilde tüm tenant'ı görür —
 * demo'daki "yalnızca kendi sınıfı" kısıtı burada uygulanamaz.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol lider tablosunu görüntüleyemez" }, { status: 403 });
  }

  const rows = await withTenantContext(actor, async (tx) => {
    const students = await tx.studentProfile.findMany({ include: { user: true, classroom: true } });
    const contexts = await Promise.all(students.map((s) => computeStudentGamificationContext(tx, s.id)));

    return students
      .map((s, i) => {
        const ctx = contexts[i];
        const level = xpLevelInfo(ctx.xp);
        return {
          studentId: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          classroom: s.classroom?.name ?? null,
          xp: ctx.xp,
          level: level.level,
          badgeCount: earnedBadges(ctx).length,
        };
      })
      .sort((a, b) => b.xp - a.xp);
  });

  return NextResponse.json({ rows });
}
