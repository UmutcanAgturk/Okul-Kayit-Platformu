import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Mezun Yönetimi — mezun profili + üniversite/iş takibi (tenant_isolation). */
// Mezun yönetimi yalnızca Şube Yöneticisi'ne açık (nav kartıyla tutarlı).
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol mezun listesini görüntüleyemez" }, { status: 403 });
  const alumni = await withBranchTenantContext(actor, (tx) => tx.alumnus.findMany({ orderBy: [{ graduationYear: "desc" }, { lastName: "asc" }] }));
  return NextResponse.json({ alumni });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol mezun kaydı ekleyemez" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const firstName = s(b.firstName); const lastName = s(b.lastName);
  if (!firstName || !lastName) return NextResponse.json({ message: "Ad ve soyad zorunludur" }, { status: 400 });
  const alumnus = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.alumnus.create({ data: { tenantId: effectiveTenantId(actor), firstName, lastName, studentNo: s(b.studentNo), graduationYear: s(b.graduationYear), university: s(b.university), employment: s(b.employment), phone: s(b.phone), email: s(b.email), note: s(b.note) } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Mezun kaydı eklendi", detail: `${firstName} ${lastName}` });
    return created;
  });
  return NextResponse.json({ alumnus }, { status: 201 });
}
