import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { invoiceId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol fatura silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    // Invoice RLS ile tenant'a scope edilmiştir — başka bir tenant'a ait bir
    // id burada zaten görünmez (null döner).
    const invoice = await tx.invoice.findUnique({ where: { id: params.invoiceId } });
    if (!invoice) return { kind: "not_found" as const };
    await tx.invoice.delete({ where: { id: params.invoiceId } });
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Fatura bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
