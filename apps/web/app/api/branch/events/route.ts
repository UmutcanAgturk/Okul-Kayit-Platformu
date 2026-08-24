import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Sosyal Etkinlik — gezi/tören/etkinlik + katılım (tenant_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  // Etkinlikler okul geneli bilgidir — kimliği doğrulanan HERKESE okunabilir
  // (öğrenci/veli etkinlikleri görür). Oluşturma (POST) yönetim/öğretmen rolleriyle sınırlı.
  const events = await withBranchTenantContext(actor, (tx) =>
    tx.schoolEvent.findMany({ include: { _count: { select: { participations: true } } }, orderBy: { startAt: "desc" } }),
  );
  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id, title: e.title, description: e.description, eventType: e.eventType, location: e.location,
      startAt: e.startAt.toISOString(), endAt: e.endAt ? e.endAt.toISOString() : null,
      participantCount: e._count.participations,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol etkinlik oluşturamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const title = s(b.title);
  const startRaw = s(b.startAt);
  if (!title) return NextResponse.json({ message: "Etkinlik başlığı zorunludur" }, { status: 400 });
  if (!startRaw) return NextResponse.json({ message: "Başlangıç tarihi zorunludur" }, { status: 400 });
  const startAt = new Date(startRaw);
  if (Number.isNaN(startAt.getTime())) return NextResponse.json({ message: "startAt geçerli bir tarih olmalı" }, { status: 400 });
  const endRaw = s(b.endAt);
  let endAt: Date | null = null;
  if (endRaw) { endAt = new Date(endRaw); if (Number.isNaN(endAt.getTime())) return NextResponse.json({ message: "endAt geçerli bir tarih olmalı" }, { status: 400 }); }
  const event = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.schoolEvent.create({ data: { tenantId: effectiveTenantId(actor), title, description: s(b.description), eventType: s(b.eventType), location: s(b.location), startAt, endAt, createdByUserId: actor.id } });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Sosyal etkinlik oluşturuldu", detail: title });
    return created;
  });
  return NextResponse.json({ event }, { status: 201 });
}
