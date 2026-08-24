import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Sağlık taramaları (aşı/diş vb.). ROL-KISITLI. */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const screenings = await withBranchTenantContext(actor, (tx) => tx.healthScreening.findMany({ orderBy: { createdAt: "desc" } }));
  return NextResponse.json({
    screenings: screenings.map((s) => ({ id: s.id, name: s.name, source: s.source, targetGrades: s.targetGrades, scheduledDate: s.scheduledDate ? s.scheduledDate.toISOString() : null, note: s.note })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const name = s(b.name);
  if (!name) return NextResponse.json({ message: "Tarama adı zorunludur" }, { status: 400 });
  const targetGrades = Array.isArray(b.targetGrades) ? b.targetGrades.filter((x: unknown) => typeof x === "string") : [];
  const schedRaw = s(b.scheduledDate);
  const scheduledDate = schedRaw ? new Date(schedRaw) : null;
  const screening = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.healthScreening.create({ data: { tenantId: effectiveTenantId(actor), name, source: s(b.source), targetGrades, scheduledDate: scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : null, note: s(b.note) } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Sağlık taraması eklendi", detail: name });
    return created;
  });
  return NextResponse.json({ screening }, { status: 201 });
}
