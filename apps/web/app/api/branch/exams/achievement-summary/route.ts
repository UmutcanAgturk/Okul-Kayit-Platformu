import { NextRequest, NextResponse } from "next/server";
import { ExamScope, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Ölçme-Değerlendirme — Kazanım Analizi. demo'daki renderKazanimTab'ın
 * karşılığı: şubenin TÜM (BRANCH kapsamlı) sınavlarındaki gerçek
 * StudentAchievementResult verisinden, kazanım bazında ortalama başarı
 * yüzdesi.
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol kazanım analizini görüntüleyemez" }, { status: 403 });
  }

  const summary = await withBranchTenantContext(actor, async (tx) => {
    const results = await tx.studentAchievementResult.findMany({
      where: { examResult: { exam: { scope: ExamScope.BRANCH } } },
      include: { achievement: true },
    });

    const byAchievement = new Map<string, { code: string; label: string; ratios: number[] }>();
    for (const r of results) {
      const bucket = byAchievement.get(r.achievementId) ?? { code: r.achievement.code, label: r.achievement.label, ratios: [] };
      bucket.ratios.push(r.correctRatio);
      byAchievement.set(r.achievementId, bucket);
    }

    return [...byAchievement.entries()]
      .map(([achievementId, v]) => ({
        achievementId,
        code: v.code,
        label: v.label,
        subject: subjectFromCode(v.code),
        avgMasteryPct: Math.round((v.ratios.reduce((a, b) => a + b, 0) / v.ratios.length) * 100),
        count: v.ratios.length,
      }))
      .sort((a, b) => a.avgMasteryPct - b.avgMasteryPct);
  });

  return NextResponse.json({ achievements: summary });
}
