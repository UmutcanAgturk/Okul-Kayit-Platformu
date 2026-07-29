import { NextRequest, NextResponse } from "next/server";
import { TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * "Global Analytics" — demo/seviye360-app.html'deki SCREENS["hq:analytics"]'in
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ — saf agregasyon (Gamification/
 * Öğrenciler-Tüm Şubeler/Akademik Yol Haritası ile aynı prensip).
 *
 * Demo'daki `BRANCHES[i].ciro` (aylık ciro) UYDURMA bir alandı — gerçek
 * karşılığı olarak `AccountingLedgerEntry`'nin GELİR toplamı kullanılır (bkz.
 * app/api/hq/accounting-ledger'daki aynı hesap). "Ders Bazlı Ortalama Net"
 * de demo'da ham cevaplardan (bu depoda hiç saklanmayan bir granülerlik)
 * hesaplanıyordu; gerçek karşılığı Karne'deki (report-card) `subjectBreakdown`
 * ile aynı yöntemle — `StudentAchievementResult.correctRatio` ortalaması —
 * ama tek bir öğrenci değil, TÜM organizasyon kapsamında hesaplanır.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez Global Analytics'i görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const branches = await tx.tenant.findMany({ where: { type: TenantType.SUBE }, orderBy: { name: "asc" } });
    const branchIds = branches.map((b) => b.id);

    const [totalStudents, examResults, achievementResults, ledgerEntries] = await Promise.all([
      tx.studentProfile.count({ where: { tenantId: { in: branchIds } } }),
      tx.examResult.findMany({ where: { tenantId: { in: branchIds } }, select: { tenantId: true, netScore: true } }),
      tx.studentAchievementResult.findMany({
        where: { student: { tenantId: { in: branchIds } } },
        select: { correctRatio: true, achievement: { select: { code: true } } },
      }),
      tx.accountingLedgerEntry.findMany({ where: { tenantId: { in: branchIds } }, select: { tenantId: true, type: true, amount: true } }),
    ]);

    const orgAvgNet = examResults.length ? examResults.reduce((sum, r) => sum + r.netScore, 0) / examResults.length : null;

    const netsByTenant = new Map<string, number[]>();
    for (const r of examResults) {
      if (!netsByTenant.has(r.tenantId)) netsByTenant.set(r.tenantId, []);
      netsByTenant.get(r.tenantId)!.push(r.netScore);
    }
    const topBranches = branches
      .map((b) => {
        const nets = netsByTenant.get(b.id) ?? [];
        return {
          tenantId: b.id,
          tenantName: b.name,
          city: b.city,
          avgNet: nets.length ? nets.reduce((a, c) => a + c, 0) / nets.length : null,
          studentCount: nets.length,
        };
      })
      .filter((r) => r.avgNet !== null)
      .sort((a, b) => (b.avgNet as number) - (a.avgNet as number))
      .slice(0, 3);

    const ratiosBySubject = new Map<string, number[]>();
    for (const a of achievementResults) {
      const subject = subjectFromCode(a.achievement.code);
      if (!ratiosBySubject.has(subject)) ratiosBySubject.set(subject, []);
      ratiosBySubject.get(subject)!.push(a.correctRatio);
    }
    const subjectPerformance = Array.from(ratiosBySubject.entries())
      .map(([subject, ratios]) => ({
        subject,
        avgMasteryPct: Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100),
        count: ratios.length,
      }))
      .sort((a, b) => b.avgMasteryPct - a.avgMasteryPct);

    const gelirByTenant = new Map<string, number>();
    for (const e of ledgerEntries) {
      if (e.type !== "GELIR") continue;
      gelirByTenant.set(e.tenantId, (gelirByTenant.get(e.tenantId) ?? 0) + Number(e.amount));
    }
    const branchRevenue = branches
      .map((b) => ({ tenantId: b.id, tenantName: b.name, city: b.city, totalGelir: gelirByTenant.get(b.id) ?? 0 }))
      .sort((a, b) => b.totalGelir - a.totalGelir);

    return {
      totalBranches: branches.length,
      totalStudents,
      orgAvgNet,
      topBranches,
      subjectPerformance,
      branchRevenue,
    };
  });

  return NextResponse.json(result);
}
