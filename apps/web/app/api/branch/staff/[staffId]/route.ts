import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
// Roller ekranı yalnızca BRANCH_ADMIN'e açık — kimin BRANCH_ADMIN/ACCOUNTING
// olduğunu değiştirebilmek, personel oluşturmaktan (ACCOUNTING de yapabilir)
// daha yüksek bir yetki gerektirir (bkz. demo'daki "roller" ekranının
// `restricted: true` işareti).
const ROLE_CHANGE_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];
const STAFF_USER_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.GUIDANCE_COORDINATOR];

/**
 * PATCH: üç ayrı endişeyi tek route'ta ele alır (gövdede hangi alanların
 * gönderildiğine göre ayrı yetki kontrolüyle):
 *  - `role`: personelin sistem rolünü değiştirir — yalnızca BRANCH_ADMIN
 *    (demo'daki "roller" ekranının gerçek karşılığı, daha yüksek yetki ister).
 *  - `username`: giriş e-postasını (kullanıcı adı) değiştirir — role ile aynı
 *    yüksek yetki (demo'daki Roller > Personel tab'ının username düzenleme
 *    alanı), diğer profil alanlarından ayrı çünkü giriş kimliğini değiştirir.
 *  - `title`/`department`/`salary`/`startDate`/`phone`/`isActive`: personel
 *    profilini düzenler / yeniden aktifleştirir — BRANCH_ADMIN/ACCOUNTING
 *    (personel oluşturmayla aynı yetki).
 */
export async function PATCH(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const hasRole = "role" in body;
  const role = typeof body.role === "string" && STAFF_USER_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : null;
  if (hasRole && !role) {
    return NextResponse.json({ message: `role şunlardan biri olmalı: ${STAFF_USER_ROLES.join(", ")}` }, { status: 400 });
  }
  if (hasRole && !ROLE_CHANGE_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol personelin sistem rolünü değiştiremez" }, { status: 403 });
  }

  const hasUsername = "username" in body;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (hasUsername && (!username || !username.includes("@"))) {
    return NextResponse.json({ message: "Geçerli bir kullanıcı adı (e-posta) zorunludur" }, { status: 400 });
  }
  if (hasUsername && !ROLE_CHANGE_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol personelin kullanıcı adını değiştiremez" }, { status: 403 });
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;
  const department = typeof body.department === "string" ? body.department.trim() || null : undefined;
  const startDate = typeof body.startDate === "string" && !isNaN(Date.parse(body.startDate)) ? new Date(body.startDate) : undefined;
  const salary = typeof body.salary === "number" && body.salary > 0 ? body.salary : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
  const hasProfileFields =
    title !== undefined || department !== undefined || startDate !== undefined || salary !== undefined || phone !== undefined || isActive !== undefined;
  if (hasProfileFields && !ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personel profilini düzenleyemez" }, { status: 403 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
      const staff = await tx.staffProfile.findUnique({ where: { id: params.staffId }, include: { user: true } });
      if (!staff) return { kind: "not_found" as const };

      if (hasRole && role) {
        await tx.user.update({ where: { id: staff.userId }, data: { role } });
        await logActivity(tx, {
          tenantId: effectiveTenantId(actor),
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Personel rolü değiştirildi",
          detail: `${staff.user.firstName} ${staff.user.lastName} → ${role}`,
        });
      }

      if (hasUsername) {
        await tx.user.update({ where: { id: staff.userId }, data: { email: username } });
        await logActivity(tx, {
          tenantId: effectiveTenantId(actor),
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Personel kullanıcı adı değiştirildi",
          detail: `${staff.user.firstName} ${staff.user.lastName} → ${username}`,
        });
      }

      if (hasProfileFields) {
        if (phone !== undefined || isActive !== undefined) {
          await tx.user.update({ where: { id: staff.userId }, data: { phone, isActive } });
        }
        await tx.staffProfile.update({ where: { id: staff.id }, data: { title, department, startDate, salary } });
      }

      const updated = await tx.staffProfile.findUniqueOrThrow({ where: { id: staff.id }, include: { user: true } });
      return { kind: "updated" as const, staff: updated };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      const target = "meta" in e && e.meta && typeof e.meta === "object" && "target" in e.meta ? String(e.meta.target) : "";
      if (target.includes("email")) {
        return NextResponse.json({ message: "Bu kullanıcı adı zaten kayıtlı" }, { status: 409 });
      }
      return NextResponse.json({ message: "Bu telefon numarası zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Personel bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
    staff: {
      id: outcome.staff.id,
      name: `${outcome.staff.user.firstName} ${outcome.staff.user.lastName}`,
      email: outcome.staff.user.email,
      phone: outcome.staff.user.phone,
      role: outcome.staff.user.role,
      isActive: outcome.staff.user.isActive,
      title: outcome.staff.title,
      department: outcome.staff.department,
      startDate: outcome.staff.startDate,
      salary: outcome.staff.salary,
    },
  });
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
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personeli devre dışı bırakamaz" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
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
