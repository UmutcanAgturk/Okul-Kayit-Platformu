import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Bordro formunun "hangi öğretmen için?" seçicisini doldurmak için — bordro
 * route'unun (bkz. app/api/branch/payroll/route.ts) kendi yorumunda dediği
 * gibi TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (tabloda
 * doğrudan bir tenantId kolonu yok), bu yüzden filtre burada `User.tenantId`
 * üzerinden uygulama katmanında yapılır — aynı deseni tekrarlar.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol öğretmen listesini görüntüleyemez" }, { status: 403 });
  }
  if (!actor.tenantId) {
    return NextResponse.json({ teachers: [] });
  }

  const teachers = await withTenantContext(actor, (tx) =>
    tx.teacherProfile.findMany({
      where: { user: { tenantId: actor.tenantId!, role: UserRole.TEACHER, isActive: true } },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      branch: t.branch,
    })),
  });
}
