import { NextRequest, NextResponse } from "next/server";
import { PaymentMethodType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

/**
 * Kayıtlı ödeme yöntemi düzenleme (task #97) — demo'daki eksikliğin
 * karşılığı: eskiden yalnızca silinebiliyordu (bkz. DELETE aşağıda), artık
 * tür/sağlayıcı/maskeli kart no/varsayılan bayrağı güncellenebiliyor. POST
 * (ekleme) ile AYNI alan seti — yalnızca gerçek kart no/CVV asla tutulmaz.
 */
export async function PATCH(request: NextRequest, { params }: { params: { studentId: string; methodId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemini düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hasType = "type" in body;
  if (hasType && !(typeof body.type === "string" && body.type in PaymentMethodType)) {
    return NextResponse.json({ message: "Geçerli bir ödeme türü (type) olmalıdır" }, { status: 400 });
  }
  const type = hasType ? (body.type as PaymentMethodType) : undefined;
  const hasProvider = "provider" in body;
  const provider = hasProvider && typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : undefined;
  const hasMaskedCardNumber = "maskedCardNumber" in body;
  const maskedCardNumber = hasMaskedCardNumber ? (typeof body.maskedCardNumber === "string" && body.maskedCardNumber.trim() ? body.maskedCardNumber.trim() : null) : undefined;
  const hasIsDefault = "isDefault" in body;
  const isDefault = body.isDefault === true;

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const method = await tx.paymentMethod.findUnique({ where: { id: params.methodId }, include: { student: { include: { user: true } } } });
    if (!method || method.studentId !== params.studentId) return { kind: "not_found" as const };

    if (hasIsDefault && isDefault) {
      await tx.paymentMethod.updateMany({ where: { studentId: params.studentId, id: { not: method.id } }, data: { isDefault: false } });
    }

    const updated = await tx.paymentMethod.update({
      where: { id: method.id },
      data: {
        ...(hasType ? { type } : {}),
        ...(hasProvider ? { provider } : {}),
        ...(hasMaskedCardNumber ? { maskedCardNumber } : {}),
        ...(hasIsDefault ? { isDefault } : {}),
      },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi düzenlendi",
      detail: `${method.student.user.firstName} ${method.student.user.lastName} — ${updated.type}`,
    });

    return { kind: "updated" as const, method: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Ödeme yöntemi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ method: outcome.method });
}

export async function DELETE(request: NextRequest, { params }: { params: { studentId: string; methodId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const method = await tx.paymentMethod.findUnique({ where: { id: params.methodId }, include: { student: { include: { user: true } } } });
    if (!method || method.studentId !== params.studentId) return { kind: "not_found" as const };

    await tx.paymentMethod.delete({ where: { id: method.id } });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi silindi",
      detail: `${method.student.user.firstName} ${method.student.user.lastName} — ${method.type}`,
    });

    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Ödeme yöntemi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
