import { NextRequest, NextResponse } from "next/server";
import { StaffStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const STAFF_STATUSES: StaffStatus[] = [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE, StaffStatus.RESIGNED];

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
 *  - `firstName`/`lastName`/`title`/`department`/`salary`/`startDate`/
 *    `phone`/`status`/`isActive`: personel profilini düzenler / yeniden
 *    aktifleştirir — BRANCH_ADMIN/ACCOUNTING (personel oluşturmayla aynı
 *    yetki). `status: RESIGNED` demo'nun üç durumlu (Aktif/İzinli/Ayrıldı)
 *    modelini yansıtır ve User.isActive'i false yapar (giriş engellenir,
 *    "Devre Dışı Bırak" ile aynı sonuç); ACTIVE/ON_LEAVE isActive'i true
 *    yapar — İzinli personel hâlâ giriş yapabilir.
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

  const firstName = typeof body.firstName === "string" && body.firstName.trim() ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" && body.lastName.trim() ? body.lastName.trim() : undefined;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;
  const department = typeof body.department === "string" ? body.department.trim() || null : undefined;
  const startDate = typeof body.startDate === "string" && !isNaN(Date.parse(body.startDate)) ? new Date(body.startDate) : undefined;
  const salary = typeof body.salary === "number" && body.salary > 0 ? body.salary : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
  const hasStatus = "status" in body;
  const status = typeof body.status === "string" && STAFF_STATUSES.includes(body.status as StaffStatus) ? (body.status as StaffStatus) : null;
  if (hasStatus && !status) {
    return NextResponse.json({ message: `status şunlardan biri olmalı: ${STAFF_STATUSES.join(", ")}` }, { status: 400 });
  }
  const hasProfileFields =
    firstName !== undefined ||
    lastName !== undefined ||
    title !== undefined ||
    department !== undefined ||
    startDate !== undefined ||
    salary !== undefined ||
    phone !== undefined ||
    isActive !== undefined ||
    hasStatus;
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
        // status → isActive senkronizasyonu: RESIGNED giriş erişimini keser
        // (Devre Dışı Bırak ile aynı sonuç), ACTIVE/ON_LEAVE geri açar —
        // ayrıca gövdede açıkça gönderilen isActive her zaman öncelikli.
        const statusDerivedIsActive = hasStatus ? status !== StaffStatus.RESIGNED : undefined;
        const resolvedIsActive = isActive !== undefined ? isActive : statusDerivedIsActive;
        if (phone !== undefined || resolvedIsActive !== undefined) {
          await tx.user.update({ where: { id: staff.userId }, data: { phone, isActive: resolvedIsActive } });
        }
        if (firstName !== undefined || lastName !== undefined) {
          await tx.user.update({ where: { id: staff.userId }, data: { firstName, lastName } });
        }
        await tx.staffProfile.update({ where: { id: staff.id }, data: { title, department, startDate, salary, status: hasStatus ? status! : undefined } });
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
      status: outcome.staff.status,
      title: outcome.staff.title,
      department: outcome.staff.department,
      startDate: outcome.staff.startDate,
      salary: outcome.staff.salary,
    },
  });
}

/**
 * Varsayılan: personeli SİLMEZ, User.isActive'i false + status'ü RESIGNED
 * yapar (deaktive eder) — bordro/defter geçmişiyle FK ilişkisi olan bir
 * kaydı gerçekten silmek veri bütünlüğünü bozar. GET /api/branch/teachers'daki
 * isActive:true filtresiyle aynı yaklaşım.
 *
 * `?permanent=true`: demo'nun "kalıcı sil" eylemi — yalnızca hiç
 * PayrollRecord'u OLMAYAN personel için izin verilir. PayrollRecord.
 * staffProfileId FK'si `ON DELETE SET NULL` olduğundan (bkz. migration
 * 20260728064932_add_staff_profile) bordrolu bir personeli silmeye çalışmak
 * Prisma P2003 DEĞİL, ham bir Postgres CHECK constraint ihlali
 * (PayrollRecord_teacher_or_staff_check, hem teacherId hem staffProfileId
 * null kalır) üretir — bu yüzden silmeden ÖNCE açıkça sayım yapılır.
 */
export async function DELETE(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personeli devre dışı bırakamaz" }, { status: 403 });
  }

  const permanent = request.nextUrl.searchParams.get("permanent") === "true";

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    // StaffProfile RLS ile tenant'a scope edilmiştir — başka bir tenant'a ait
    // bir id burada zaten görünmez (null döner).
    const staff = await tx.staffProfile.findUnique({ where: { id: params.staffId } });
    if (!staff) {
      return { kind: "not_found" as const };
    }
    if (permanent) {
      const payrollCount = await tx.payrollRecord.count({ where: { staffProfileId: staff.id } });
      if (payrollCount > 0) {
        return { kind: "has_payroll" as const };
      }
      await tx.staffProfile.delete({ where: { id: staff.id } });
      await tx.user.delete({ where: { id: staff.userId } });
      return { kind: "deleted" as const };
    }
    await tx.user.update({ where: { id: staff.userId }, data: { isActive: false } });
    await tx.staffProfile.update({ where: { id: staff.id }, data: { status: StaffStatus.RESIGNED } });
    return { kind: "deactivated" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Personel bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "has_payroll") {
    return NextResponse.json(
      { message: "Bu personelin bordro geçmişi olduğu için kalıcı olarak silinemez — yalnızca devre dışı bırakılabilir." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
