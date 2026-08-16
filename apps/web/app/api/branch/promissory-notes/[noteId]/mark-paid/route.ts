import { NextRequest, NextResponse } from "next/server";
import { PromissoryNoteStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function POST(request: NextRequest, { params }: { params: { noteId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol senedi ödendi olarak işaretleyemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const note = await tx.promissoryNote.findUnique({ where: { id: params.noteId } });
    if (!note) return { kind: "not_found" as const };
    if (note.status === PromissoryNoteStatus.ODENDI) return { kind: "already_paid" as const };

    const updated = await tx.promissoryNote.update({
      where: { id: params.noteId },
      data: { status: PromissoryNoteStatus.ODENDI, paidAt: new Date() },
    });
    return { kind: "updated" as const, promissoryNote: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Senet bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_paid") {
    return NextResponse.json({ message: "Bu senet zaten ödendi olarak işaretlenmiş" }, { status: 409 });
  }
  return NextResponse.json({ promissoryNote: outcome.promissoryNote });
}
