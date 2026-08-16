import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

/**
 * Bordro formunun "hangi öğretmen için?" seçicisini doldurmak için — bordro
 * route'unun (bkz. app/api/branch/payroll/route.ts) kendi yorumunda dediği
 * gibi TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (tabloda
 * doğrudan bir tenantId kolonu yok), bu yüzden filtre burada `User.tenantId`
 * üzerinden uygulama katmanında yapılır — aynı deseni tekrarlar. PARENT de
 * dahil edilmiştir: Veli-Öğretmen Görüşme Randevusu formunda velinin
 * öğretmen seçebilmesi için kullanılır. STUDENT de dahildir: Etüt
 * Randevularım formunda öğrencinin kendi etüt talebi için öğretmen
 * seçebilmesi için kullanılır (bkz. app/api/students/[studentId]/study-sessions).
 */
// Opsiyonel ?subject= — demo'daki "ders bazlı öğretmen havuzu"nun karşılığı
// (bkz. task #57): Etüt talebi formunda önce bir ders seçilir, yalnızca o
// dersi veren (TeacherProfile.branch eşleşen) öğretmenler listelenir.
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.PARENT, UserRole.STUDENT];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen listesini görüntüleyemez" }, { status: 403 });
  }
  if (!actor.tenantId && !actor.actingTenantId) {
    return NextResponse.json({ teachers: [] });
  }

  const subject = request.nextUrl.searchParams.get("subject");

  const teachers = await withBranchTenantContext(actor, (tx) =>
    tx.teacherProfile.findMany({
      where: {
        user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER, isActive: true },
        ...(subject ? { branch: subject } : {}),
      },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      branch: t.branch,
      isMentor: t.isMentor,
    })),
  });
}
