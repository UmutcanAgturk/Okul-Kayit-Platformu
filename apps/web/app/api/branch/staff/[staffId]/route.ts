import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

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
