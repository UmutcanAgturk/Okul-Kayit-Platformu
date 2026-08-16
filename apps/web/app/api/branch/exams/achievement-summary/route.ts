import { NextRequest, NextResponse } from "next/server";
import { ExamScope, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { ratioToMastery, subjectFromCode } from "@/lib/curriculum";

function emptyTierCounts() {
  return { critical: 0, weak: 0, strong: 0 };
}
function addTier(counts: { critical: number; weak: number; strong: number }, ratio: number) {
  const tier = ratioToMastery(ratio);
  if (tier === "CRITICAL") counts.critical += 1;
  else if (tier === "WEAK") counts.weak += 1;
  else counts.strong += 1;
}

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
    const overallDistribution = emptyTierCounts();
    const bySubjectRatios = new Map<string, number[]>();
    const bySubjectDistribution = new Map<string, ReturnType<typeof emptyTierCounts>>();
    const bySubjectAchievementIds = new Map<string, Set<string>>();

    for (const r of results) {
      const bucket = byAchievement.get(r.achievementId) ?? { code: r.achievement.code, label: r.achievement.label, ratios: [] };
      bucket.ratios.push(r.correctRatio);
      byAchievement.set(r.achievementId, bucket);

      addTier(overallDistribution, r.correctRatio);

      const subject = subjectFromCode(r.achievement.code);
      if (!bySubjectRatios.has(subject)) bySubjectRatios.set(subject, []);
      bySubjectRatios.get(subject)!.push(r.correctRatio);
      if (!bySubjectDistribution.has(subject)) bySubjectDistribution.set(subject, emptyTierCounts());
      addTier(bySubjectDistribution.get(subject)!, r.correctRatio);
      if (!bySubjectAchievementIds.has(subject)) bySubjectAchievementIds.set(subject, new Set());
      bySubjectAchievementIds.get(subject)!.add(r.achievementId);
    }

    const achievements = [...byAchievement.entries()]
      .map(([achievementId, v]) => ({
        achievementId,
        code: v.code,
        label: v.label,
        subject: subjectFromCode(v.code),
        avgMasteryPct: Math.round((v.ratios.reduce((a, b) => a + b, 0) / v.ratios.length) * 100),
        count: v.ratios.length,
      }))
      .sort((a, b) => a.avgMasteryPct - b.avgMasteryPct);

    const bySubject = [...bySubjectRatios.entries()]
      .map(([subject, ratios]) => ({
        subject,
        avgMasteryPct: Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100),
        achievementCount: bySubjectAchievementIds.get(subject)!.size,
        distribution: bySubjectDistribution.get(subject)!,
      }))
      .sort((a, b) => a.avgMasteryPct - b.avgMasteryPct);

    return { achievements, distribution: overallDistribution, bySubject };
  });

  return NextResponse.json(summary);
}
