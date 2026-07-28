import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { receiptId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol dekont silemez" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id: params.receiptId } });
    if (!receipt) return { kind: "not_found" as const };
    await tx.receipt.delete({ where: { id: params.receiptId } });
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Dekont bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
