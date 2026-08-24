import { NextRequest, NextResponse } from "next/server";
import { TaskPriority, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Görevler & Onaylar — kurumsal görev/onay iş akışı (tenant_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER, UserRole.ACCOUNTING];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;
const PRIORITIES = new Set(Object.values(TaskPriority));

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol görevleri görüntüleyemez" }, { status: 403 });
  const tasks = await withBranchTenantContext(actor, (tx) =>
    tx.task.findMany({ include: { _count: { select: { approvals: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
  );
  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id, title: t.title, description: t.description, priority: t.priority, status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null, requiresApproval: t.requiresApproval, approvalCount: t._count.approvals,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol görev oluşturamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim() : null;
  if (!title) return NextResponse.json({ message: "Görev başlığı zorunludur" }, { status: 400 });
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const priority = typeof b.priority === "string" && PRIORITIES.has(b.priority as TaskPriority) ? (b.priority as TaskPriority) : TaskPriority.NORMAL;
  const dueRaw = typeof b.dueDate === "string" && b.dueDate ? new Date(b.dueDate) : null;
  const dueDate = dueRaw && !Number.isNaN(dueRaw.getTime()) ? dueRaw : null;
  const requiresApproval = b.requiresApproval === true;
  const task = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.task.create({ data: { tenantId: effectiveTenantId(actor), title, description, priority, dueDate, requiresApproval, createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Görev oluşturuldu", detail: title });
    return created;
  });
  return NextResponse.json({ task }, { status: 201 });
}
