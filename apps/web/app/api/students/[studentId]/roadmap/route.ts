import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * "Seviye 360 Akademik Yol Haritam" — demo/seviye360-app.html'deki
 * SCREENS["student:roadmap"]'in gerçek karşılığı. Karne (bkz.
 * app/api/students/[studentId]/report-card) ile aynı prensip: yeni bir veri
 * modeli EKLEMEZ. `StudentProfile.targetGoal` zaten şemada vardı (demo'daki
 * `self.hedef`'in karşılığı), "kritik kazanımlar" listesi ise AI Sınıf
 * Röntgeni'ndeki (bkz. class-xray route) `ratioToMastery` eşiğiyle birebir
 * aynı mantıkla, öğrencinin TÜM sınavlarındaki `StudentAchievementResult`
 * ortalaması üzerinden hesaplanır (tek bir sınava değil, genel performansa
 * bakar — daha isabetli bir "AI tavsiyesi" için). Yetki kontrolü Karne ile
 * birebir aynıdır.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
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

    const examResults = await tx.examResult.findMany({
      where: { studentId: student.id },
      include: { exam: true, achievementResults: { include: { achievement: true } } },
      orderBy: { exam: { examDate: "desc" } },
    });

    const latest = examResults[0] ?? null;
    const latestNet = latest?.netScore ?? null;
    const maxPossibleNet = latest ? latest.correctCount + latest.wrongCount + latest.emptyCount : null;
    const netPct = latestNet !== null && maxPossibleNet ? Math.max(0, Math.min(100, Math.round((latestNet / maxPossibleNet) * 100))) : 0;

    const byAchievement = new Map<string, { code: string; label: string; ratios: number[] }>();
    for (const r of examResults) {
      for (const a of r.achievementResults) {
        const entry = byAchievement.get(a.achievementId) ?? { code: a.achievement.code, label: a.achievement.label, ratios: [] };
        entry.ratios.push(a.correctRatio);
        byAchievement.set(a.achievementId, entry);
      }
    }

    const criticalAchievements = Array.from(byAchievement.entries())
      .map(([achievementId, v]) => ({
        achievementId,
        code: v.code,
        label: v.label,
        subject: subjectFromCode(v.code),
        avgRatio: v.ratios.reduce((a, b) => a + b, 0) / v.ratios.length,
      }))
      .filter((a) => a.avgRatio < 0.4)
      .sort((a, b) => a.avgRatio - b.avgRatio)
      .slice(0, 5);

    return {
      kind: "ok" as const,
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      gradeLevel: student.gradeLevel,
      targetGoal: student.targetGoal,
      examCount: examResults.length,
      latestNet,
      maxPossibleNet,
      netPct,
      criticalAchievements,
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin akademik yol haritasını görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
