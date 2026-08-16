import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

/**
 * İletişim — Hazır Şablonlar. demo/seviye360-app.html'deki MESSAGE_TEMPLATES
 * CRUD'unun gerçek karşılığı — bkz. prisma/schema.prisma MessageTemplate
 * modelindeki not. Mesaj gönderme ile AYNI yetki deseni (bkz.
 * app/api/branch/messages/route.ts).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];
const KIND_VALUES = ["bildirim", "mesaj"];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol şablonları görüntüleyemez" }, { status: 403 });
  }

  const templates = await withBranchTenantContext(actor, (tx) =>
    tx.messageTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  );

  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      kind: t.kind,
      category: t.category,
      title: t.title,
      body: t.body,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol şablon oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === "string" && KIND_VALUES.includes(body.kind) ? body.kind : "mesaj";
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "Genel";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const templateBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!title || !templateBody) {
    return NextResponse.json({ message: "title ve body zorunludur" }, { status: 400 });
  }

  const template = await withBranchTenantContext(actor, (tx) =>
    tx.messageTemplate.create({
      data: { tenantId: effectiveTenantId(actor), kind, category, title, body: templateBody },
    }),
  );

  return NextResponse.json(
    {
      template: {
        id: template.id,
        kind: template.kind,
        category: template.category,
        title: template.title,
        body: template.body,
        createdAt: template.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
