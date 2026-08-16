import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Öğretmen Performansı — demo/seviye360-app.html'deki "ogretmenperf" ekranının
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ: CurriculumNode/Exam'de
 * öğretmen-ders eşlemesi tutan bir alan yok (bkz. lib/curriculum.ts'teki
 * "CurriculumNode'da ayrı bir subject alanı yok" notu), bu yüzden performans
 * TeacherProfile.branch ("Matematik" gibi bir zümre adı) ile aynı zümredeki
 * TÜM StudentAchievementResult satırlarının ortalama correctRatio'sundan
 * hesaplanır — Global Analytics'teki subjectPerformance ile birebir aynı
 * ilke (bkz. app/api/hq/analytics), yalnızca tek bir tenant'a scope edilmiş
 * ve öğretmen bazında gruplanmış hali.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen performansını görüntüleyemez" }, { status: 403 });
  }

  const teachers = await withBranchTenantContext(actor, async (tx) => {
    // DİKKAT: TeacherProfile'da da (StudentAchievementResult gibi) RLS yok —
    // tabloda doğrudan bir tenantId kolonu yok (bkz. app/api/branch/teachers'daki
    // aynı not). Tenant filtresi burada `User.tenantId` üzerinden AÇIKÇA uygulanır.
    const teacherProfiles = await tx.teacherProfile.findMany({
      where: { user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER, isActive: true } },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    });

    // DİKKAT: StudentAchievementResult tablosunda RLS YOK (bkz. prisma/rls/README.md
    // — yalnızca ExamResult/StudentProfile gibi ilişkili tablolarda tenant_isolation
    // var). Bu yüzden tenant filtresi burada AÇIKÇA `student.tenantId` üzerinden
    // uygulanır — aksi halde bir BRANCH_ADMIN tüm şubelerin verisini görürdü.
    const achievementRows = await tx.studentAchievementResult.findMany({
      where: { student: { tenantId: effectiveTenantId(actor) } },
      include: { achievement: true },
    });

    const ratiosBySubject = new Map<string, number[]>();
    for (const row of achievementRows) {
      const subject = subjectFromCode(row.achievement.code);
      if (!ratiosBySubject.has(subject)) ratiosBySubject.set(subject, []);
      ratiosBySubject.get(subject)!.push(row.correctRatio);
    }

    return teacherProfiles.map((t) => {
      const ratios = ratiosBySubject.get(t.branch) ?? [];
      const avgMasteryPct = ratios.length > 0 ? Math.round((ratios.reduce((sum, r) => sum + r, 0) / ratios.length) * 100) : null;
      return {
        teacherId: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        branch: t.branch,
        title: t.title,
        resultCount: ratios.length,
        avgMasteryPct,
      };
    });
  });

  return NextResponse.json({ teachers });
}
