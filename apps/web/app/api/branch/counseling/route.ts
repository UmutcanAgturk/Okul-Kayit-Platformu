import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Rehberlik Olay Takibi — vaka/olay yönetimi. ROL-KISITLI (tenant_and_role_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol rehberlik kayıtlarını görüntüleyemez" }, { status: 403 });
  const cases = await withBranchTenantContext(actor, (tx) => tx.counselingCase.findMany({ orderBy: { openedAt: "desc" }, take: 200 }));
  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id, subjectName: c.subjectName, studentId: c.studentId, reason: c.reason, counselors: c.counselors,
      description: c.description, status: c.status, openedAt: c.openedAt.toISOString(), closedAt: c.closedAt ? c.closedAt.toISOString() : null, closureReason: c.closureReason,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol olay açamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const reason = s(b.reason);
  if (!reason) return NextResponse.json({ message: "Açılma nedeni zorunludur" }, { status: 400 });
  const counselors = Array.isArray(b.counselors) ? b.counselors.filter((x: unknown) => typeof x === "string") : [];
  const ccase = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.counselingCase.create({ data: { tenantId: effectiveTenantId(actor), reason, subjectName: s(b.subjectName), studentId: s(b.studentId), counselors, description: s(b.description), createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Rehberlik olayı açıldı", detail: reason });
    return created;
  });
  return NextResponse.json({ case: ccase }, { status: 201 });
}
