import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, tenantScopeFilter } from "@/lib/db-context";

/**
 * Roller > Veliler sekmesi. `ParentProfile` RLS taşımaz (bkz.
 * app/api/branch/students/[studentId]/route.ts'deki User tablosuyla aynı
 * mimari not) — bu yüzden StudentGuardian üzerinden, tenant'a scope edilmiş
 * StudentProfile ile açıkça filtrelenerek sorgulanır. Bir veli birden fazla
 * öğrencinin velisi olabileceğinden bir satır = bir öğrenci-veli ilişkisi
 * (demo'daki "roller" ekranının Veliler tab'ıyla aynı granülerlik).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol veli kullanıcı adlarını görüntüleyemez" }, { status: 403 });
  }

  const guardians = await withBranchTenantContext(actor, async (tx) => {
    const rows = await tx.studentGuardian.findMany({
      where: { student: { ...tenantScopeFilter(actor) } },
      include: { student: { include: { user: true } }, parent: { include: { user: true } } },
      orderBy: { student: { user: { firstName: "asc" } } },
    });
    return rows.map((r) => ({
      parentId: r.parentId,
      guardianName: `${r.parent.user.firstName} ${r.parent.user.lastName}`,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      relation: r.relation,
      username: r.parent.user.email,
    }));
  });

  return NextResponse.json({ guardians });
}
