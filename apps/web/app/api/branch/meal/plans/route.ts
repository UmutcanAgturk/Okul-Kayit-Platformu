import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Yemekhane — Menü Planı (MenuPlan). GET her kimliği doğrulanmış aktöre açıktır
 * (öğrenci/veli menüyü görür), POST yalnızca BRANCH_ADMIN (veya "şube olarak
 * yönet"teki SUPERADMIN) tarafından yapılır. Planlar tarihe göre azalan sıralı.
 */
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const plans = await withBranchTenantContext(actor, (tx) =>
    tx.menuPlan.findMany({ orderBy: { date: "desc" } }),
  );

  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      mealType: p.mealType,
      gradeLevels: p.gradeLevels,
      items: p.items,
      expectedParticipation: p.expectedParticipation,
      note: p.note,
      published: p.published,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol menü planı oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dateRaw = typeof body.date === "string" ? new Date(body.date) : null;
  const date = dateRaw && !Number.isNaN(dateRaw.getTime()) ? dateRaw : null;
  const mealType = typeof body.mealType === "string" && body.mealType.trim() ? body.mealType.trim() : null;
  const gradeLevels = Array.isArray(body.gradeLevels)
    ? body.gradeLevels.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim())
    : [];
  const items = Array.isArray(body.items)
    ? body.items.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim())
    : [];
  const expectedParticipation =
    Number.isInteger(body.expectedParticipation) && body.expectedParticipation >= 0 ? body.expectedParticipation : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const published = typeof body.published === "boolean" ? body.published : false;

  if (!date) {
    return NextResponse.json({ message: "date zorunludur" }, { status: 400 });
  }

  const plan = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.menuPlan.create({
      data: {
        tenantId: effectiveTenantId(actor),
        date,
        mealType,
        gradeLevels,
        items,
        expectedParticipation,
        note,
        published,
      },
    });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Menü planı oluşturuldu",
      detail: date.toLocaleDateString("tr-TR"),
    });
    return created;
  });

  return NextResponse.json({ plan }, { status: 201 });
}
