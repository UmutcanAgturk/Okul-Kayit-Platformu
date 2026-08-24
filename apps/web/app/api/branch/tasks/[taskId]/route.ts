import { NextRequest, NextResponse } from "next/server";
import { TaskStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/** Görev durumu güncelleme (OPEN/IN_PROGRESS/DONE/CANCELLED). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER, UserRole.ACCOUNTING];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;
const STATUSES = new Set(Object.values(TaskStatus));

export async function PATCH(request: NextRequest, { params }: { params: { taskId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.status !== "string" || !STATUSES.has(b.status as TaskStatus)) return NextResponse.json({ message: "Geçersiz durum" }, { status: 400 });
  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const t = await tx.task.findUnique({ where: { id: params.taskId } });
    if (!t) return { kind: "not_found" as const };
    await tx.task.update({ where: { id: t.id }, data: { status: b.status as TaskStatus } });
    return { kind: "ok" as const };
  });
  if (outcome.kind === "not_found") return NextResponse.json({ message: "Görev bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
