import { NextRequest, NextResponse } from "next/server";
import { PaymentMethodType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Ödeme Yöntemleri — demo/seviye360-app.html'deki "odeme" ekranının gerçek
 * karşılığı. PaymentMethod modeli şemada baştan beri vardı ama hiçbir route
 * kullanmıyordu (bkz. Muhasebe/PaymentInstallment'ın aksine burada gerçek
 * kart numarası/CVV asla tutulmaz — yalnızca maskedCardNumber ve bir
 * providerCardToken referansı, gerçek bir ödeme sağlayıcısı entegrasyonunun
 * yerini tutan alanlar).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemlerini görüntüleyemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };
    const methods = await tx.paymentMethod.findMany({
      where: { studentId: params.studentId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return { kind: "ok" as const, methods };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ methods: outcome.methods });
}

export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol ödeme yöntemi ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = typeof body.type === "string" && body.type in PaymentMethodType ? (body.type as PaymentMethodType) : null;
  if (!type) {
    return NextResponse.json({ message: "Geçerli bir ödeme türü (type) zorunludur" }, { status: 400 });
  }
  const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : "ParamPOS";
  const maskedCardNumber = typeof body.maskedCardNumber === "string" && body.maskedCardNumber.trim() ? body.maskedCardNumber.trim() : null;
  const isDefault = body.isDefault === true;

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
    if (!student) return { kind: "not_found" as const };

    if (isDefault) {
      await tx.paymentMethod.updateMany({ where: { studentId: params.studentId }, data: { isDefault: false } });
    }

    const method = await tx.paymentMethod.create({
      data: { tenantId: effectiveTenantId(actor), studentId: params.studentId, type, provider, maskedCardNumber, isDefault },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödeme yöntemi eklendi",
      detail: `${student.user.firstName} ${student.user.lastName} — ${type}`,
    });

    return { kind: "created" as const, method };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ method: outcome.method }, { status: 201 });
}
