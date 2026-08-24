import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

/** Akademik yılı aktif yap (diğerlerini pasifleştir). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function PATCH(request: NextRequest, { params }: { params: { yearId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const y = await tx.academicYear.findUnique({ where: { id: params.yearId } });
    if (!y) return { kind: "not_found" as const };
    await tx.academicYear.updateMany({ where: { tenantId: effectiveTenantId(actor), active: true }, data: { active: false } });
    await tx.academicYear.update({ where: { id: y.id }, data: { active: true } });
    return { kind: "ok" as const };
  });
  if (outcome.kind === "not_found") return NextResponse.json({ message: "Akademik yıl bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
