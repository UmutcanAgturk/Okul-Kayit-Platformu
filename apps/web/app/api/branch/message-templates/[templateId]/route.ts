import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];
const KIND_VALUES = ["bildirim", "mesaj"];

export async function PATCH(request: NextRequest, { params }: { params: { templateId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol şablon düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === "string" && KIND_VALUES.includes(body.kind) ? body.kind : undefined;
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : undefined;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;
  const templateBody = typeof body.body === "string" && body.body.trim() ? body.body.trim() : undefined;

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const existing = await tx.messageTemplate.findUnique({ where: { id: params.templateId } });
    if (!existing) return { kind: "not_found" as const };
    const updated = await tx.messageTemplate.update({
      where: { id: existing.id },
      data: { kind, category, title, body: templateBody },
    });
    return { kind: "updated" as const, template: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Şablon bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
    template: {
      id: outcome.template.id,
      kind: outcome.template.kind,
      category: outcome.template.category,
      title: outcome.template.title,
      body: outcome.template.body,
      createdAt: outcome.template.createdAt.toISOString(),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { templateId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol şablon silemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const template = await tx.messageTemplate.findUnique({ where: { id: params.templateId } });
    if (!template) return { kind: "not_found" as const };
    await tx.messageTemplate.delete({ where: { id: template.id } });
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Şablon bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
