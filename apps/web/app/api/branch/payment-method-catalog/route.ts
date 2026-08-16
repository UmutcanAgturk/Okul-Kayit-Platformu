import { NextRequest, NextResponse } from "next/server";
import { InstitutionPaymentMethodType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Kayıtlı Yöntemler" — demo/seviye360-app.html'deki CURRENT_BRANCH.paymentMethods
 * kataloğunun gerçek karşılığı. `PaymentMethod` (bkz.
 * app/api/branch/students/[studentId]/payment-methods) bir VELİNİN kayıtlı
 * kartı/tercihidir; bu route ise ŞUBENİN kendi tahsilat araçlarının (banka
 * hesabı/POS/kasa/senet) kurum geneli kataloğudur — studentId taşımaz.
 *
 * GET, ayrıca PARENT rolüne de açıktır (bkz. task #55 — Ödeme İşlemleri'ndeki
 * havale/nakit akışlarının şubenin IBAN'ını/teslim noktasını göstermesi
 * gerekir). PARENT yalnızca AKTİF kayıtları görür ve POST/PATCH/DELETE'e
 * erişemez — RLS politikası da PARENT'ı kapsayacak şekilde güncellendi (bkz.
 * prisma/migrations/20260816193000_institution_payment_method_parent_read).
 */
const READ_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.PARENT];
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!READ_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi kataloğunu görüntüleyemez" }, { status: 403 });
  }

  const methods = await withBranchTenantContext(actor, (tx) =>
    tx.institutionPaymentMethod.findMany({
      where: { tenantId: effectiveTenantId(actor), ...(actor.role === UserRole.PARENT ? { isActive: true } : {}) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
  );

  return NextResponse.json({ methods });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi kataloğuna ekleme yapamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type =
    typeof body.type === "string" && body.type in InstitutionPaymentMethodType ? (body.type as InstitutionPaymentMethodType) : null;
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const extra = typeof body.extra === "string" && body.extra.trim() ? body.extra.trim() : null;
  const isDefault = body.isDefault === true;

  if (!type || !label) {
    return NextResponse.json({ message: "type ve label zorunludur" }, { status: 400 });
  }

  const tenantId = effectiveTenantId(actor);
  const method = await withBranchTenantContext(actor, async (tx) => {
    if (isDefault) {
      await tx.institutionPaymentMethod.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }
    const created = await tx.institutionPaymentMethod.create({
      data: { tenantId, type, label, extra, isDefault },
    });

    await logActivity(tx, {
      tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi kataloğa eklendi",
      detail: `${label} (${type})`,
    });

    return created;
  });

  return NextResponse.json({ method }, { status: 201 });
}
