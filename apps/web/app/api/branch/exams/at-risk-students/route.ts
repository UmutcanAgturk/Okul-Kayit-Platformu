import { NextRequest, NextResponse } from "next/server";
import { ExamScope, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { ratioToMastery } from "@/lib/curriculum";

/**
 * Ölçme-Değerlendirme — Kazanım Analizi'ndeki "Desteğe İhtiyaç Duyan
 * Öğrenciler" tablosu (demo'daki renderKazanimTab). achievement-summary
 * rotası öğrenciler arasında ortalama alır (kimlik kaybolur) — bu route
 * tam tersine, her öğrencinin KRİTİK (ratioToMastery < 0.4) olduğu
 * kazanımları öğrenci kimliğiyle listeler. `achievementId` query param'ı
 * verilirse (demo'daki risk filtresi) yalnızca o kazanımda kritik olan
 * öğrenciler döner.
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

  const achievementIdFilter = request.nextUrl.searchParams.get("achievementId");

  const students = await withBranchTenantContext(actor, async (tx) => {
    const results = await tx.studentAchievementResult.findMany({
      where: { examResult: { exam: { scope: ExamScope.BRANCH } } },
      include: {
        achievement: true,
        examResult: { include: { student: { include: { user: true, classroom: true } } } },
      },
    });

    const byStudent = new Map<
      string,
      { studentId: string; name: string; classroomName: string | null; critical: Map<string, { achievementId: string; code: string; label: string }> }
    >();

    for (const r of results) {
      if (ratioToMastery(r.correctRatio) !== "CRITICAL") continue;
      if (achievementIdFilter && r.achievementId !== achievementIdFilter) continue;

      const student = r.examResult.student;
      const bucket = byStudent.get(student.id) ?? {
        studentId: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        classroomName: student.classroom?.name ?? null,
        critical: new Map(),
      };
      bucket.critical.set(r.achievementId, { achievementId: r.achievementId, code: r.achievement.code, label: r.achievement.label });
      byStudent.set(student.id, bucket);
    }

    return [...byStudent.values()]
      .map((s) => ({
        studentId: s.studentId,
        name: s.name,
        classroomName: s.classroomName,
        criticalAchievements: [...s.critical.values()],
      }))
      .sort((a, b) => b.criticalAchievements.length - a.criticalAchievements.length);
  });

  return NextResponse.json({ students });
}
