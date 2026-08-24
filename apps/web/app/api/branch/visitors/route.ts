import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Ziyaretçi Yönetimi — okul girişinde ziyaretçi giriş/çıkış kaydı. */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol ziyaretçi kayıtlarını görüntüleyemez" }, { status: 403 });
  const visitors = await withBranchTenantContext(actor, (tx) => tx.visitorLog.findMany({ orderBy: { checkInAt: "desc" }, take: 200 }));
  return NextResponse.json({
    visitors: visitors.map((v) => ({ id: v.id, visitorName: v.visitorName, reason: v.reason, hostName: v.hostName, phone: v.phone, checkInAt: v.checkInAt.toISOString(), checkOutAt: v.checkOutAt ? v.checkOutAt.toISOString() : null })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol ziyaretçi kaydı ekleyemez" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const visitorName = s(b.visitorName);
  if (!visitorName) return NextResponse.json({ message: "Ziyaretçi adı zorunludur" }, { status: 400 });
  const visitor = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.visitorLog.create({ data: { tenantId: effectiveTenantId(actor), visitorName, reason: s(b.reason), hostName: s(b.hostName), phone: s(b.phone), createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Ziyaretçi girişi kaydedildi", detail: visitorName });
    return created;
  });
  return NextResponse.json({ visitor }, { status: 201 });
}
