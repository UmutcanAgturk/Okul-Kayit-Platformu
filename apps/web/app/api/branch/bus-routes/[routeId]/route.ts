import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

/**
 * Bir servis güzergahının üye yönetimi için tam öğrenci listesi (roster) +
 * atanma durumu — demo'daki "Öğrencileri Yönet" panelinin karşılığı.
 */
export async function GET(request: NextRequest, { params }: { params: { routeId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol servis güzergahı yönetemez" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    const route = await tx.busRoute.findUnique({ where: { id: params.routeId } });
    if (!route) return { kind: "not_found" as const };

    const roster = await tx.studentProfile.findMany({
      where: { tenantId: effectiveTenantId(actor) },
      include: { user: true, classroom: true },
      orderBy: { user: { firstName: "asc" } },
    });

    return {
      kind: "ok" as const,
      route: {
        id: route.id,
        name: route.name,
        driverName: route.driverName,
        driverPhone: route.driverPhone,
        capacity: route.capacity,
        stops: route.stops,
      },
      roster: roster.map((s) => ({
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        classroom: s.classroom?.name ?? null,
        isMember: s.busRouteId === route.id,
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Güzergah bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(result);
}
