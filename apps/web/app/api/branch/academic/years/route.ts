import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Dönem Geçişleri — akademik yıl kayıtları (tenant_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;
const MAX_YEAR = 2050;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const years = await withBranchTenantContext(actor, (tx) => tx.academicYear.findMany({ orderBy: { startYear: "asc" } }));
  return NextResponse.json({ years: years.map((y) => ({ id: y.id, label: y.label, startYear: y.startYear, active: y.active })) });
}

/**
 * POST — body.action:
 *  "generate": mevcut yıldan MAX_YEAR (2050)'ye kadar eksik akademik yılları
 *              oluşturur (idempotent). Hiç aktif yıl yoksa ilkini aktif yapar.
 *  aksi halde tek yıl ekler (label + startYear).
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const b = await request.json().catch(() => ({}));

  if (b.action === "generate") {
    const fromYear = Number.isInteger(b.fromYear) ? b.fromYear : new Date().getFullYear();
    const result = await withBranchTenantContext(actor, async (tx) => {
      const existing = new Set((await tx.academicYear.findMany({ select: { startYear: true } })).map((y) => y.startYear));
      let created = 0;
      for (let sy = fromYear; sy <= MAX_YEAR; sy++) {
        if (existing.has(sy)) continue;
        await tx.academicYear.create({ data: { tenantId: effectiveTenantId(actor), label: `${sy}-${sy + 1}`, startYear: sy, active: false } });
        created++;
      }
      const anyActive = await tx.academicYear.findFirst({ where: { active: true } });
      if (!anyActive) {
        const first = await tx.academicYear.findFirst({ where: { startYear: fromYear } });
        if (first) await tx.academicYear.update({ where: { id: first.id }, data: { active: true } });
      }
      await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Akademik yıllar oluşturuldu", detail: `${fromYear}–${MAX_YEAR} (${created} yeni)` });
      return { created };
    });
    return NextResponse.json({ ok: true, created: result.created }, { status: 201 });
  }

  const label = typeof b.label === "string" && b.label.trim() ? b.label.trim() : null;
  const startYear = Number.isInteger(b.startYear) ? b.startYear : null;
  if (!label || startYear == null) return NextResponse.json({ message: "label ve startYear zorunludur" }, { status: 400 });
  const year = await withBranchTenantContext(actor, (tx) => tx.academicYear.create({ data: { tenantId: effectiveTenantId(actor), label, startYear, active: false } }));
  return NextResponse.json({ year }, { status: 201 });
}
