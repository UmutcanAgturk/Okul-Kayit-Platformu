import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function PATCH(request: NextRequest, { params }: { params: { methodId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi kataloğunu düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : undefined;
  const extra = typeof body.extra === "string" ? (body.extra.trim() || null) : undefined;
  const isDefault = body.isDefault === true ? true : undefined;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

  const tenantId = effectiveTenantId(actor);
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const method = await tx.institutionPaymentMethod.findUnique({ where: { id: params.methodId } });
    if (!method || method.tenantId !== tenantId) return null;

    if (isDefault) {
      await tx.institutionPaymentMethod.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }

    const updated = await tx.institutionPaymentMethod.update({
      where: { id: method.id },
      data: { label, extra, isDefault, isActive },
    });

    await logActivity(tx, {
      tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi kataloğu güncellendi",
      detail: updated.label,
    });

    return updated;
  });

  if (!outcome) {
    return NextResponse.json({ message: "Ödeme yöntemi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ method: outcome });
}

export async function DELETE(request: NextRequest, { params }: { params: { methodId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi kataloğundan silemez" }, { status: 403 });
  }

  const tenantId = effectiveTenantId(actor);
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const method = await tx.institutionPaymentMethod.findUnique({ where: { id: params.methodId } });
    if (!method || method.tenantId !== tenantId) return null;

    await tx.institutionPaymentMethod.delete({ where: { id: method.id } });

    await logActivity(tx, {
      tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi kataloğundan silindi",
      detail: method.label,
    });

    return true;
  });

  if (!outcome) {
    return NextResponse.json({ message: "Ödeme yöntemi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
