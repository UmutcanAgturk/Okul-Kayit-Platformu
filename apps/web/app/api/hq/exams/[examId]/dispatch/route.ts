import { NextRequest, NextResponse } from "next/server";
import { BookletDispatchStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.SUPERADMIN];

/**
 * "Basılı Kitapçık Kargo Durumu" — demo'daki BOOKLET_DISPATCH_STATUSES
 * döngüsünün (Hazırlanıyor → Basılıyor → Kargoya Verildi → Teslim Edildi)
 * karşılığı. Döngü mantığı istemcide (HqExamsPanel) hesaplanır, bu route
 * yalnızca gönderilen hedef durumu geçerli enum değeriyle doğrulayıp
 * ExamBranchDispatch satırını günceller.
 */
export async function PATCH(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez sevkiyat durumunu değiştirebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" && body.tenantId ? body.tenantId : null;
  const status = typeof body.status === "string" && (Object.values(BookletDispatchStatus) as string[]).includes(body.status)
    ? (body.status as BookletDispatchStatus)
    : null;

  if (!tenantId || !status) {
    return NextResponse.json({ message: "tenantId ve geçerli bir status zorunludur" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const dispatch = await tx.examBranchDispatch.findUnique({
      where: { examId_tenantId: { examId: params.examId, tenantId } },
      include: { exam: true, tenant: true },
    });
    if (!dispatch) return null;

    const updated = await tx.examBranchDispatch.update({
      where: { id: dispatch.id },
      data: { status },
    });

    await logActivity(tx, {
      tenantId: dispatch.tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kitapçık sevkiyat durumu güncellendi",
      detail: `${dispatch.exam.name} — ${dispatch.tenant.name}: ${status}`,
    });

    return { dispatch: updated };
  });

  if (!outcome) {
    return NextResponse.json({ message: "Bu sınav bu şubeyi hedeflemiyor" }, { status: 404 });
  }
  return NextResponse.json({ tenantId: outcome.dispatch.tenantId, status: outcome.dispatch.status });
}
