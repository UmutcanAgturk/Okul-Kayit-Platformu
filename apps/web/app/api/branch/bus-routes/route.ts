import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Servis / Ulaşım Takibi — demo'daki "branch:servis" ekranının karşılığı.
 * `BusRoute` yalnızca düz `tenant_isolation` taşır (bkz. prisma/schema.prisma)
 * — Kulüpler ile aynı desen. Yalnızca BRANCH_ADMIN güzergah oluşturabilir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol servis güzergahlarını listeleyemez" }, { status: 403 });
  }

  const routes = await withBranchTenantContext(actor, (tx) =>
    tx.busRoute.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: "asc" },
    }),
  );

  return NextResponse.json({
    routes: routes.map((r) => ({
      id: r.id,
      name: r.name,
      driverName: r.driverName,
      driverPhone: r.driverPhone,
      capacity: r.capacity,
      stops: r.stops,
      memberCount: r._count.students,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol servis güzergahı oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const driverName = typeof body.driverName === "string" && body.driverName.trim() ? body.driverName.trim() : null;
  const driverPhone = typeof body.driverPhone === "string" && body.driverPhone.trim() ? body.driverPhone.trim() : null;
  const capacity = Number.isInteger(body.capacity) && body.capacity > 0 ? body.capacity : 20;
  const stops = Array.isArray(body.stops) ? body.stops.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim()) : [];

  if (!name) {
    return NextResponse.json({ message: "name zorunludur" }, { status: 400 });
  }

  const route = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.busRoute.create({
      data: { tenantId: effectiveTenantId(actor), name, driverName, driverPhone, capacity, stops },
    });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Servis güzergahı oluşturuldu",
      detail: name,
    });
    return created;
  });

  return NextResponse.json({ route }, { status: 201 });
}
