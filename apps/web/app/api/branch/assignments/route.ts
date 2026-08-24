import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Ödevler — kazanım bağlı, tamamlanma takipli ödev sistemi (tenant_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  // Ödev listesi kimliği doğrulanan HERKESE okunabilir (öğrenci/veli kendi
  // sınıflarının ödevlerini görür — Takvim/Yemekhane ile aynı desen). Oluşturma
  // (POST) ise yönetim/öğretmen rolleriyle sınırlıdır.
  const assignments = await withBranchTenantContext(actor, (tx) =>
    tx.assignment.findMany({ include: { _count: { select: { submissions: true } } }, orderBy: { createdAt: "desc" } }),
  );
  return NextResponse.json({
    assignments: assignments.map((a) => ({
      id: a.id, title: a.title, description: a.description, classroomId: a.classroomId,
      startDate: a.startDate ? a.startDate.toISOString() : null,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      attachments: a.attachments, submissionCount: a._count.submissions,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol ödev oluşturamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const title = s(b.title);
  if (!title) return NextResponse.json({ message: "Ödev başlığı zorunludur" }, { status: 400 });
  const parseDate = (v: unknown) => { const d = typeof v === "string" && v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
  const attachments = Array.isArray(b.attachments) ? b.attachments.filter((x: unknown) => typeof x === "string") : [];
  const assignment = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.assignment.create({ data: { tenantId: effectiveTenantId(actor), title, description: s(b.description), classroomId: s(b.classroomId), startDate: parseDate(b.startDate), dueDate: parseDate(b.dueDate), attachments, createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Ödev oluşturuldu", detail: title });
    return created;
  });
  return NextResponse.json({ assignment }, { status: 201 });
}
