import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Takvim etkinliği silme. Oluşturma (POST /api/branch/calendar) ile aynı yazma
 * yetkisi: BRANCH_ADMIN / GUIDANCE_COORDINATOR veya bir şube olarak yöneten
 * SUPERADMIN. Silme, RLS (tenant_isolation) altında kendi şubesiyle sınırlıdır.
 */
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

function canWrite(actor: { role: UserRole; actingTenantId?: string | null }) {
  return WRITE_ROLES.includes(actor.role) || (actor.role === UserRole.SUPERADMIN && !!actor.actingTenantId);
}

export async function DELETE(request: NextRequest, { params }: { params: { eventId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!canWrite(actor)) {
    return NextResponse.json({ message: "Bu rol takvim etkinliği silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const event = await tx.calendarEvent.findUnique({ where: { id: params.eventId } });
    if (!event) return { kind: "not_found" as const };
    await tx.calendarEvent.delete({ where: { id: params.eventId } });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Takvim etkinliği silindi",
      detail: event.title,
    });
    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Etkinlik bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
