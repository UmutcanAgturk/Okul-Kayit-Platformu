import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

/**
 * Vergi Ayarları — şube muhasebesinin kendi Vergi No / Vergi Dairesi
 * bilgisi (bkz. task #84, demo renderTaxSettingsCard). Kurumlar (HQ) formu
 * yalnızca SUPERADMIN'e açıktır (bkz. app/api/hq/tenants); bu uç nokta ise
 * şubenin kendi Muhasebe ekranından düzenlenebilmesi içindir.
 *
 * Tenant tablosunda RLS politikası YOKTUR (kendisi tenantId FK taşımaz —
 * bkz. prisma/rls/README.md) — bu yüzden hem GET hem PATCH, dönen/güncellenen
 * satırın gerçekten effectiveTenantId(actor) olduğunu uygulama katmanında
 * elle doğrular (TeacherProfile'daki aynı desen, bkz. app/api/branch/payroll).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol vergi ayarlarını görüntüleyemez" }, { status: 403 });
  }

  const tenant = await withBranchTenantContext(actor, (tx) =>
    tx.tenant.findUnique({ where: { id: effectiveTenantId(actor) }, select: { taxNo: true, taxOffice: true } }),
  );

  return NextResponse.json({ settings: tenant ?? { taxNo: null, taxOffice: null } });
}

export async function PATCH(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol vergi ayarlarını değiştiremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const taxNo = typeof body.taxNo === "string" ? body.taxNo.trim() || null : undefined;
  const taxOffice = typeof body.taxOffice === "string" ? body.taxOffice.trim() || null : undefined;

  const tenant = await withBranchTenantContext(actor, (tx) =>
    tx.tenant.update({
      where: { id: effectiveTenantId(actor) },
      data: { ...(taxNo !== undefined ? { taxNo } : {}), ...(taxOffice !== undefined ? { taxOffice } : {}) },
      select: { taxNo: true, taxOffice: true },
    }),
  );

  return NextResponse.json({ settings: tenant });
}
