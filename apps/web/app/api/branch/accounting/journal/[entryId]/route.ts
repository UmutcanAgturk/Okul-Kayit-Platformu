import { NextRequest, NextResponse } from "next/server";
import { JournalSource, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Yevmiye fişi silme. Yalnızca ELLE girilen (MANUEL) fişler silinebilir;
 * otomatik (tahsilat/gider/fatura/bordro) fişler kaynak işlemle birlikte
 * yönetilir ve buradan silinemez (muhasebe izinin bütünlüğü için).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { entryId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe'ye erişemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const entry = await tx.journalEntry.findUnique({ where: { id: params.entryId } });
    if (!entry) return { kind: "not_found" as const };
    if (entry.source !== JournalSource.MANUEL) return { kind: "not_manual" as const };
    await tx.journalEntry.delete({ where: { id: params.entryId } });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Yevmiye fişi silindi",
      detail: `${entry.no} — ${entry.description}`,
    });
    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") return NextResponse.json({ message: "Fiş bulunamadı" }, { status: 404 });
  if (outcome.kind === "not_manual") return NextResponse.json({ message: "Otomatik oluşturulan fişler silinemez" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
