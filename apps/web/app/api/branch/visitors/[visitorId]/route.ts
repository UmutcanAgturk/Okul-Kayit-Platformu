import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/** Ziyaretçi çıkışı — checkOutAt = şimdi. */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function PATCH(request: NextRequest, { params }: { params: { visitorId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const v = await tx.visitorLog.findUnique({ where: { id: params.visitorId } });
    if (!v) return { kind: "not_found" as const };
    await tx.visitorLog.update({ where: { id: v.id }, data: { checkOutAt: new Date() } });
    return { kind: "ok" as const };
  });
  if (outcome.kind === "not_found") return NextResponse.json({ message: "Ziyaretçi kaydı bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
