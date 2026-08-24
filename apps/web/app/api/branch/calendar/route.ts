import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Takvim / Etkinlikler — okul takvimindeki etkinlikleri listeler ve oluşturur.
 * `CalendarEvent` yalnızca düz `tenant_isolation` taşır (bkz. prisma/schema.prisma)
 * — Servis ile aynı desen. Takvim her rol tarafından OKUNABİLİR; yalnızca
 * BRANCH_ADMIN / (şube olarak yöneten SUPERADMIN) / GUIDANCE_COORDINATOR
 * etkinlik oluşturabilir.
 */
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

function canWrite(actor: { role: UserRole; actingTenantId?: string | null }) {
  return WRITE_ROLES.includes(actor.role) || (actor.role === UserRole.SUPERADMIN && !!actor.actingTenantId);
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const events = await withBranchTenantContext(actor, (tx) =>
    tx.calendarEvent.findMany({
      orderBy: { startAt: "asc" },
    }),
  );

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      location: e.location,
      description: e.description,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt ? e.endAt.toISOString() : null,
      allDay: e.allDay,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!canWrite(actor)) {
    return NextResponse.json({ message: "Bu rol takvim etkinliği oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  const eventType = typeof body.eventType === "string" && body.eventType.trim() ? body.eventType.trim() : null;
  const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const startAtRaw = typeof body.startAt === "string" && body.startAt.trim() ? body.startAt.trim() : null;
  const endAtRaw = typeof body.endAt === "string" && body.endAt.trim() ? body.endAt.trim() : null;
  const allDay = body.allDay === true;

  if (!title) {
    return NextResponse.json({ message: "title zorunludur" }, { status: 400 });
  }
  if (!startAtRaw) {
    return NextResponse.json({ message: "startAt zorunludur" }, { status: 400 });
  }
  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ message: "startAt geçerli bir tarih olmalı" }, { status: 400 });
  }
  let endAt: Date | null = null;
  if (endAtRaw) {
    endAt = new Date(endAtRaw);
    if (Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ message: "endAt geçerli bir tarih olmalı" }, { status: 400 });
    }
  }

  const event = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.calendarEvent.create({
      data: {
        tenantId: effectiveTenantId(actor),
        title,
        eventType,
        location,
        description,
        startAt,
        endAt,
        allDay,
        createdByUserId: actor.id,
      },
    });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Takvim etkinliği oluşturuldu",
      detail: title,
    });
    return created;
  });

  return NextResponse.json({ event }, { status: 201 });
}
