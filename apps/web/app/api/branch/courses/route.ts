import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Kurs / Ders Kataloğu — kredili ders/kurs tanımları (tenant_isolation). */
// Kurs kataloğu yalnızca Şube Yöneticisi'ne açık (nav kartıyla tutarlı).
const READ_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!READ_ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol kurs listesini görüntüleyemez" }, { status: 403 });
  const courses = await withBranchTenantContext(actor, (tx) => tx.course.findMany({ orderBy: { code: "asc" } }));
  return NextResponse.json({ courses });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!WRITE_ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol kurs oluşturamaz" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const credit = Number.isFinite(body.credit) ? Math.trunc(body.credit) : null;
  const weeklyHours = Number.isFinite(body.weeklyHours) ? Math.trunc(body.weeklyHours) : null;
  const mandatory = body.mandatory === true;
  const gradeLevels = Array.isArray(body.gradeLevels) ? body.gradeLevels.filter((g: unknown) => typeof g === "string") : [];
  if (!code) return NextResponse.json({ message: "code zorunludur" }, { status: 400 });
  if (!name) return NextResponse.json({ message: "name zorunludur" }, { status: 400 });
  const course = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.course.create({ data: { tenantId: effectiveTenantId(actor), code, name, description, credit, weeklyHours, mandatory, gradeLevels } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Kurs oluşturuldu", detail: `${code} — ${name}` });
    return created;
  });
  return NextResponse.json({ course }, { status: 201 });
}
