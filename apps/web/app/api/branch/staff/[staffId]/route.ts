import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
// Roller ekranı yalnızca BRANCH_ADMIN'e açık — kimin BRANCH_ADMIN/ACCOUNTING
// olduğunu değiştirebilmek, personel oluşturmaktan (ACCOUNTING de yapabilir)
// daha yüksek bir yetki gerektirir (bkz. demo'daki "roller" ekranının
// `restricted: true` işareti).
const ROLE_CHANGE_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];
const STAFF_USER_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.GUIDANCE_COORDINATOR];

/**
 * PATCH: personelin sistem rolünü (BRANCH_ADMIN/ACCOUNTING/GUIDANCE_COORDINATOR)
 * değiştirir — demo'daki "roller" ekranının gerçek karşılığı.
 */
export async function PATCH(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLE_CHANGE_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol personelin sistem rolünü değiştiremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === "string" && STAFF_USER_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : null;
  if (!role) {
    return NextResponse.json({ message: `role şunlardan biri olmalı: ${STAFF_USER_ROLES.join(", ")}` }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const staff = await tx.staffProfile.findUnique({ where: { id: params.staffId }, include: { user: true } });
    if (!staff) return { kind: "not_found" as const };

    await tx.user.update({ where: { id: staff.userId }, data: { role } });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Personel rolü değiştirildi",
      detail: `${staff.user.firstName} ${staff.user.lastName} → ${role}`,
    });

    return { kind: "updated" as const, staffId: staff.id, role };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Personel bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ staffId: outcome.staffId, role: outcome.role });
}

/**
 * Personeli SİLMEZ, User.isActive'i false yapar (deaktive eder) — bordro/
 * defter geçmişiyle FK ilişkisi olan bir kaydı gerçekten silmek (bkz.
 * accounting-ledger/[entryId]'deki P2003 notu) veri bütünlüğünü bozar.
 * GET /api/branch/teachers'daki isActive:true filtresiyle aynı yaklaşım.
 */
export async function DELETE(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol personeli devre dışı bırakamaz" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    // StaffProfile RLS ile tenant'a scope edilmiştir — başka bir tenant'a ait
    // bir id burada zaten görünmez (null döner).
    const staff = await tx.staffProfile.findUnique({ where: { id: params.staffId } });
    if (!staff) {
      return { kind: "not_found" as const };
    }
    await tx.user.update({ where: { id: staff.userId }, data: { isActive: false } });
    return { kind: "deactivated" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Personel bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
