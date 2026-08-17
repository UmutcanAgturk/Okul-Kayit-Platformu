import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/** Roller > Veliler — Tüm Şubeler (task #100) — bkz. ../staff/route.ts yorumu. */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez tüm şubelerdeki velileri görüntüleyebilir" }, { status: 403 });
  }

  const guardians = await withTenantContext(actor, (tx) =>
    tx.studentGuardian.findMany({
      include: { student: { include: { user: true, tenant: true } }, parent: { include: { user: true } } },
      orderBy: { student: { tenant: { name: "asc" } } },
    }),
  );

  return NextResponse.json({
    guardians: guardians.map((r) => ({
      parentId: r.parentId,
      guardianName: `${r.parent.user.firstName} ${r.parent.user.lastName}`,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      relation: r.relation,
      username: r.parent.user.email,
      tenantId: r.student.tenantId,
      tenantName: r.student.tenant.name,
    })),
  });
}
