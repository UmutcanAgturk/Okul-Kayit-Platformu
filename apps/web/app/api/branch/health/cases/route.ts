import { NextRequest, NextResponse } from "next/server";
import { MedicalSeverity, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Sağlık / Revir — tıbbi vakalar. ROL-KISITLI (tenant_and_role_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;
const SEV = new Set(Object.values(MedicalSeverity));

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol sağlık kayıtlarını görüntüleyemez" }, { status: 403 });
  const cases = await withBranchTenantContext(actor, (tx) => tx.medicalCase.findMany({ orderBy: { openedAt: "desc" }, take: 200 }));
  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id, patientName: c.patientName, studentId: c.studentId, severity: c.severity, status: c.status,
      description: c.description, notes: c.notes, openedAt: c.openedAt.toISOString(), closedAt: c.closedAt ? c.closedAt.toISOString() : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol vaka açamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const patientName = s(b.patientName);
  if (!patientName) return NextResponse.json({ message: "Hasta adı zorunludur" }, { status: 400 });
  const severity = typeof b.severity === "string" && SEV.has(b.severity as MedicalSeverity) ? (b.severity as MedicalSeverity) : MedicalSeverity.DUSUK;
  const mcase = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.medicalCase.create({ data: { tenantId: effectiveTenantId(actor), patientName, studentId: s(b.studentId), severity, description: s(b.description), notes: s(b.notes), createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Tıbbi vaka açıldı", detail: patientName });
    return created;
  });
  return NextResponse.json({ case: mcase }, { status: 201 });
}
