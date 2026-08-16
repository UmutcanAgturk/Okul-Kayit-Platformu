import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function DELETE(request: NextRequest, { params }: { params: { slotId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ders programından silme yapamaz" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const slot = await tx.timetableSlot.findUnique({ where: { id: params.slotId }, include: { classroom: true } });
    if (!slot) return { kind: "not_found" as const };

    await tx.timetableSlot.delete({ where: { id: slot.id } });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ders programından silindi",
      detail: `${slot.classroom.name} — ${slot.subject}`,
    });

    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Ders programı kaydı bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
