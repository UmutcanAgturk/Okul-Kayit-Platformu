import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Bir kurumu SİLMEZ, `Tenant.isActive`'i tersine çevirir (deaktive/yeniden
 * etkinleştirir) — StaffProfile DELETE route'undaki (bkz.
 * app/api/branch/staff/[staffId]/route.ts) "gerçek bir kaydı silmek veri
 * bütünlüğünü bozar" gerekçesiyle aynı desen; bir kurumun onlarca gerçek
 * öğrenci/personel/ödeme kaydı olabileceğinden gerçek silme çok daha
 * yıkıcı olurdu.
 */
export async function POST(request: NextRequest, { params }: { params: { tenantId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kurum durumunu değiştirebilir" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) return null;
    if (tenant.type === "GENEL_MERKEZ") return { error: "genel_merkez" as const };

    const updated = await tx.tenant.update({ where: { id: tenant.id }, data: { isActive: !tenant.isActive } });

    await logActivity(tx, {
      tenantId: tenant.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: updated.isActive ? "Kurum yeniden etkinleştirildi" : "Kurum devre dışı bırakıldı",
      detail: tenant.name,
    });

    return { tenant: updated };
  });

  if (!outcome) {
    return NextResponse.json({ message: "Kurum bulunamadı" }, { status: 404 });
  }
  if ("error" in outcome) {
    return NextResponse.json({ message: "Genel Merkez devre dışı bırakılamaz" }, { status: 400 });
  }
  return NextResponse.json({ isActive: outcome.tenant.isActive });
}
