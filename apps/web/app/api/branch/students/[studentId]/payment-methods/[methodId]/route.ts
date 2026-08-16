import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { studentId: string; methodId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi silemez" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const method = await tx.paymentMethod.findUnique({ where: { id: params.methodId }, include: { student: { include: { user: true } } } });
    if (!method || method.studentId !== params.studentId) return { kind: "not_found" as const };

    await tx.paymentMethod.delete({ where: { id: method.id } });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
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
