import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/** Vakayı kapat (status=KAPALI, closedAt=now). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function PATCH(request: NextRequest, { params }: { params: { caseId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const c = await tx.medicalCase.findUnique({ where: { id: params.caseId } });
    if (!c) return { kind: "not_found" as const };
    await tx.medicalCase.update({ where: { id: c.id }, data: { status: "KAPALI", closedAt: new Date() } });
    return { kind: "ok" as const };
  });
  if (outcome.kind === "not_found") return NextResponse.json({ message: "Vaka bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
