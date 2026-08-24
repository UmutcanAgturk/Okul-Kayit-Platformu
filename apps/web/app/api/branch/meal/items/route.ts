import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Yemekhane — Ürünler (MealItem). Menü öğrencilerin/velilerin de gördüğü bir
 * ekran olduğundan GET her kimliği doğrulanmış aktöre açıktır; POST yalnızca
 * BRANCH_ADMIN (veya "şube olarak yönet"teki SUPERADMIN) tarafından yapılır.
 */
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const items = await withBranchTenantContext(actor, (tx) =>
    tx.mealItem.findMany({ orderBy: { createdAt: "asc" } }),
  );

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      barcode: i.barcode,
      active: i.active,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol yemekhane ürünü ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  const barcode = typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null;
  const active = typeof body.active === "boolean" ? body.active : true;

  if (!name) {
    return NextResponse.json({ message: "name zorunludur" }, { status: 400 });
  }

  const item = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.mealItem.create({
      data: { tenantId: effectiveTenantId(actor), name, category, barcode, active },
    });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Yemekhane ürünü eklendi",
      detail: name,
    });
    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}
