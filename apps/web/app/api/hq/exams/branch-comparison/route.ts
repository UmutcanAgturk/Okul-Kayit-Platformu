import { NextRequest, NextResponse } from "next/server";
import { ExamScope, GradeLevel, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * "Şubeler Arası Karşılaştırmalı Net Sıralaması" — demo'daki
 * branchOlcmeComparison()'ın gerçek karşılığı (bkz. Ölçme-Değerlendirme >
 * Durum sekmesi, yalnızca "bare" SUPERADMIN — henüz bir şube seçmemiş
 * Genel Merkez görünümü — için gösterilir). Global Analytics'teki
 * (app/api/hq/analytics) `topBranches` alanından FARKLI olarak burada TÜM
 * şubeler (yalnızca ilk 3 değil) katılım oranıyla BİRLİKTE listelenir.
 *
 * avgNet: o şubedeki TÜM ExamResult.netScore'ların ortalaması (Global
 * Analytics'teki topBranches ile aynı yöntem — demo'daki gibi öğrenci
 * başına "son sınav neti" DEĞİL, gerçek şemada her sınav sonucu ayrı bir
 * satır olduğundan daha doğru bir agregasyon).
 * avgKatilim: o şubedeki her BRANCH kapsamlı sınavın participationPct'inin
 * ortalaması (bkz. app/api/branch/exams GET — aynı payda mantığı).
 * examTakers: o şubede en az bir sınav sonucu olan DİSTİNCT öğrenci sayısı.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez şubeler arası karşılaştırmayı görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const branches = await tx.tenant.findMany({ where: { type: TenantType.SUBE }, orderBy: { name: "asc" } });
    const branchIds = branches.map((b) => b.id);

    const [activeStudents, examResults, exams] = await Promise.all([
      tx.studentProfile.findMany({
        where: { tenantId: { in: branchIds }, user: { isActive: true } },
        select: { tenantId: true, gradeLevel: true },
      }),
      tx.examResult.findMany({
        where: { tenantId: { in: branchIds } },
        select: { tenantId: true, studentId: true, netScore: true },
      }),
      tx.exam.findMany({
        where: { tenantId: { in: branchIds }, scope: ExamScope.BRANCH },
        select: { tenantId: true, eligibleGradeLevels: true, _count: { select: { results: true } } },
      }),
    ]);

    const countByGradeByTenant = new Map<string, Map<GradeLevel, number>>();
    for (const s of activeStudents) {
      const byGrade = countByGradeByTenant.get(s.tenantId) ?? new Map<GradeLevel, number>();
      byGrade.set(s.gradeLevel, (byGrade.get(s.gradeLevel) ?? 0) + 1);
      countByGradeByTenant.set(s.tenantId, byGrade);
    }
    const activeCountByTenant = new Map<string, number>();
    for (const s of activeStudents) activeCountByTenant.set(s.tenantId, (activeCountByTenant.get(s.tenantId) ?? 0) + 1);

    const netsByTenant = new Map<string, number[]>();
    const takersByTenant = new Map<string, Set<string>>();
    for (const r of examResults) {
      if (!netsByTenant.has(r.tenantId)) netsByTenant.set(r.tenantId, []);
      netsByTenant.get(r.tenantId)!.push(r.netScore);
      if (!takersByTenant.has(r.tenantId)) takersByTenant.set(r.tenantId, new Set());
      takersByTenant.get(r.tenantId)!.add(r.studentId);
    }

    const participationByTenant = new Map<string, number[]>();
    for (const e of exams) {
      const byGrade = countByGradeByTenant.get(e.tenantId);
      const eligibleStudentCount =
        e.eligibleGradeLevels.length > 0
          ? e.eligibleGradeLevels.reduce((sum, g) => sum + (byGrade?.get(g) ?? 0), 0)
          : activeCountByTenant.get(e.tenantId) ?? 0;
      if (eligibleStudentCount <= 0) continue;
      const pct = Math.round((e._count.results / eligibleStudentCount) * 100);
      if (!participationByTenant.has(e.tenantId)) participationByTenant.set(e.tenantId, []);
      participationByTenant.get(e.tenantId)!.push(pct);
    }

    const branchRows = branches
      .map((b) => {
        const nets = netsByTenant.get(b.id) ?? [];
        const participations = participationByTenant.get(b.id) ?? [];
        return {
          tenantId: b.id,
          tenantName: b.name,
          city: b.city,
          avgNet: nets.length ? Number((nets.reduce((a, c) => a + c, 0) / nets.length).toFixed(2)) : null,
          avgKatilim: participations.length ? Math.round(participations.reduce((a, c) => a + c, 0) / participations.length) : null,
          examTakers: takersByTenant.get(b.id)?.size ?? 0,
        };
      })
      .filter((r) => r.avgNet !== null)
      .sort((a, b) => (b.avgNet as number) - (a.avgNet as number));

    return { branches: branchRows };
  });

  return NextResponse.json(result);
}
