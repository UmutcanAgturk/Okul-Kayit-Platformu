import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Dönem Geçişi (sınıf yükseltme). Aktif akademik yıldaki tüm öğrencileri bir
 * üst sınıfa taşır (SINIF_12 → MEZUN); geçiş sonrası bir sonraki yılı aktif
 * yapar ve bir PromotionRun kaydı oluşturur. Çift-yükseltmeyi önlemek için
 * sınıflar YÜKSEKTEN ALÇAĞA işlenir.
 */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

const ORDER: GradeLevel[] = [
  GradeLevel.ANASINIFI_3_YAS, GradeLevel.ANASINIFI_4_YAS, GradeLevel.ANASINIFI_5_YAS,
  GradeLevel.SINIF_1, GradeLevel.SINIF_2, GradeLevel.SINIF_3, GradeLevel.SINIF_4, GradeLevel.SINIF_5,
  GradeLevel.SINIF_6, GradeLevel.SINIF_7, GradeLevel.SINIF_8, GradeLevel.SINIF_9, GradeLevel.SINIF_10,
  GradeLevel.SINIF_11, GradeLevel.SINIF_12, GradeLevel.MEZUN,
];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const runs = await withBranchTenantContext(actor, (tx) => tx.promotionRun.findMany({ orderBy: { runAt: "desc" }, take: 50 }));
  return NextResponse.json({
    runs: runs.map((r) => ({ id: r.id, fromYearLabel: r.fromYearLabel, toYearLabel: r.toYearLabel, promotedCount: r.promotedCount, graduatedCount: r.graduatedCount, note: r.note, runAt: r.runAt.toISOString() })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol dönem geçişi yapamaz" }, { status: 403 });

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const active = await tx.academicYear.findFirst({ where: { active: true } });
    if (!active) return { kind: "no_active_year" as const };
    const next = await tx.academicYear.findFirst({ where: { startYear: active.startYear + 1 } });
    const toLabel = next ? next.label : `${active.startYear + 1}-${active.startYear + 2}`;

    // Mezun olacaklar (SINIF_12) önce sayılır.
    const graduatedCount = await tx.studentProfile.count({ where: { gradeLevel: GradeLevel.SINIF_12 } });

    // Yüksekten alçağa: her seviyeyi bir üstüne taşı (çift-yükseltme önlenir).
    let promotedCount = 0;
    for (let i = ORDER.length - 2; i >= 0; i--) {
      const from = ORDER[i];
      const to = ORDER[i + 1];
      const res = await tx.studentProfile.updateMany({ where: { gradeLevel: from }, data: { gradeLevel: to } });
      promotedCount += res.count;
    }

    // Bir sonraki yılı aktifleştir.
    if (next) {
      await tx.academicYear.updateMany({ where: { tenantId: effectiveTenantId(actor), active: true }, data: { active: false } });
      await tx.academicYear.update({ where: { id: next.id }, data: { active: true } });
    }

    const run = await tx.promotionRun.create({
      data: { tenantId: effectiveTenantId(actor), fromYearLabel: active.label, toYearLabel: toLabel, runByUserId: actor.id, promotedCount, graduatedCount, note: next ? null : "Sonraki yıl kaydı yoktu; yalnızca sınıflar yükseltildi." },
    });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Dönem geçişi yapıldı", detail: `${active.label} → ${toLabel} (${promotedCount} öğrenci, ${graduatedCount} mezun)` });
    return { kind: "ok" as const, run };
  });

  if (outcome.kind === "no_active_year") return NextResponse.json({ message: "Aktif akademik yıl yok. Önce yılları oluşturup birini aktif yapın." }, { status: 400 });
  return NextResponse.json({ run: outcome.run }, { status: 201 });
}
