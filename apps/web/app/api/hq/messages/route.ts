import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * İletişim — HQ Yayını (task #101) — demo denetimindeki bulgu: Genel Merkez
 * (bare SUPERADMIN) hiç mesaj gönderemiyordu; demo'da "Tüm Sistem (Tüm
 * Şubeler)" kapsamı ve "Şube Müdürleri" alıcı türü yalnızca HQ portalında
 * vardı (bkz. demo renderIletisimCompose isHq dalı). Branch-scoped
 * /api/branch/messages'tan AYRI bir uç gerekir çünkü Message.tenantId NOT
 * NULL + RLS `tenantId = current_setting('app.tenant_id')` (bkz.
 * migrations/20260728144925_add_message_rls) — TEK bir Message satırı asla
 * birden fazla tenant'ın gelen kutusuna görünemez. Bu yüzden burada hedeflenen
 * HER şube için AYRI bir Message satırı (kendi tenantId'siyle) oluşturulur;
 * `withTenantContext` SUPERADMIN için RLS bypass'ına geçtiğinden bu tek bir
 * transaction'da yapılabilir.
 */
type HqRecipientType = "STUDENTS" | "GUARDIANS" | "TEACHERS" | "MANAGERS";
const RECIPIENT_TYPE_VALUES: HqRecipientType[] = ["STUDENTS", "GUARDIANS", "TEACHERS", "MANAGERS"];
const RECIPIENT_TYPE_LABEL: Record<HqRecipientType, string> = {
  STUDENTS: "Öğrenciler",
  GUARDIANS: "Veliler",
  TEACHERS: "Öğretmenler",
  MANAGERS: "Şube Müdürleri",
};

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez HQ yayınlarını görüntüleyebilir" }, { status: 403 });
  }

  const messages = await withTenantContext(actor, (tx) =>
    tx.message.findMany({
      where: { senderUserId: actor.id },
      include: { _count: { select: { recipients: true } }, attachments: true, tenant: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      audienceLabel: `${m.audienceLabel} — ${m.tenant.name}`,
      recipientCount: m._count.recipients,
      createdAt: m.createdAt.toISOString(),
      attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, dataUrl: a.dataUrl })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez HQ yayını gönderebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
  const rawTypes = Array.isArray(body?.recipientTypes) ? body.recipientTypes : [];
  const recipientTypes: HqRecipientType[] = rawTypes.filter((t: unknown): t is HqRecipientType => RECIPIENT_TYPE_VALUES.includes(t as HqRecipientType));

  if (!title || !messageBody || recipientTypes.length === 0) {
    return NextResponse.json({ message: "Başlık, mesaj ve en az bir alıcı türü zorunludur" }, { status: 400 });
  }

  const typeLabels = recipientTypes.map((t) => RECIPIENT_TYPE_LABEL[t]).join(", ");
  const audienceLabel = `Tüm Sistem · ${typeLabels}`;

  const outcome = await withTenantContext(actor, async (tx) => {
    const tenants = await tx.tenant.findMany({ where: { type: { in: ["SUBE", "BOLUM"] }, isActive: true } });

    let totalRecipients = 0;
    let tenantsReached = 0;
    const createdMessageIds: string[] = [];

    for (const tenant of tenants) {
      const recipientUserIds = new Set<string>();

      if (recipientTypes.includes("STUDENTS") || recipientTypes.includes("GUARDIANS")) {
        const students = await tx.studentProfile.findMany({
          where: { tenantId: tenant.id },
          include: { guardians: { include: { parent: true } } },
        });
        if (recipientTypes.includes("STUDENTS")) {
          for (const s of students) recipientUserIds.add(s.userId);
        }
        if (recipientTypes.includes("GUARDIANS")) {
          for (const s of students) {
            for (const g of s.guardians) recipientUserIds.add(g.parent.userId);
          }
        }
      }
      if (recipientTypes.includes("TEACHERS")) {
        const teachers = await tx.teacherProfile.findMany({ where: { user: { tenantId: tenant.id, role: UserRole.TEACHER } }, select: { userId: true } });
        for (const t of teachers) recipientUserIds.add(t.userId);
      }
      if (recipientTypes.includes("MANAGERS")) {
        const managers = await tx.user.findMany({ where: { tenantId: tenant.id, role: UserRole.BRANCH_ADMIN }, select: { id: true } });
        for (const m of managers) recipientUserIds.add(m.id);
      }
      recipientUserIds.delete(actor.id);

      if (recipientUserIds.size === 0) continue;

      const message = await tx.message.create({
        data: {
          tenantId: tenant.id,
          senderUserId: actor.id,
          senderLabel: actorLabel(actor),
          title,
          body: messageBody,
          audienceLabel,
          recipients: { createMany: { data: Array.from(recipientUserIds).map((userId) => ({ userId })) } },
        },
      });

      await logActivity(tx, {
        tenantId: tenant.id,
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "Genel Merkez yayını alındı",
        detail: `${title} — ${audienceLabel} (${recipientUserIds.size} kişi)`,
      });

      createdMessageIds.push(message.id);
      totalRecipients += recipientUserIds.size;
      tenantsReached += 1;
    }

    return { totalRecipients, tenantsReached, messageIds: createdMessageIds };
  });

  return NextResponse.json(
    { audienceLabel, recipientCount: outcome.totalRecipients, tenantsReached: outcome.tenantsReached },
    { status: 201 },
  );
}
