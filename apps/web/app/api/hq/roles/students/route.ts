import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/** Roller > Öğrenciler — Tüm Şubeler (task #100) — bkz. ../staff/route.ts yorumu. */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez tüm şubelerdeki öğrencileri görüntüleyebilir" }, { status: 403 });
  }

  const students = await withTenantContext(actor, (tx) =>
    tx.studentProfile.findMany({
      include: { user: true, tenant: true, classroom: true },
      orderBy: [{ tenant: { name: "asc" } }, { user: { firstName: "asc" } }],
    }),
  );

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      studentNo: s.studentNo,
      classroomName: s.classroom?.name ?? null,
      username: s.user.email,
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
    })),
  });
}
