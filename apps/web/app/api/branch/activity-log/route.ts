import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Aktivite Akışı (Audit Log) — demo'daki "branch:aktivite" ekranının
 * karşılığı. `AuditLogEntry` Muhasebe/Personel/Belgeler ile aynı
 * `tenant_and_role_isolation` deseni (yalnızca SUPERADMIN/BRANCH_ADMIN) —
 * bkz. prisma/schema.prisma'daki not.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol aktivite akışını görüntüleyemez" }, { status: 403 });
  }

  const entries = await withBranchTenantContext(actor, (tx) =>
    tx.auditLogEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      actorLabel: e.actorLabel,
      action: e.action,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
