import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { noteId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol senet silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const note = await tx.promissoryNote.findUnique({ where: { id: params.noteId } });
    if (!note) return { kind: "not_found" as const };
    await tx.promissoryNote.delete({ where: { id: params.noteId } });
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Senet bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
