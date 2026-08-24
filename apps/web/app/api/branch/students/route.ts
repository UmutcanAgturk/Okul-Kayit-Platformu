import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Şube Öğrenciler roster'ı — demo'daki "branch:students" ekranının gerçek
 * karşılığı. Genel Merkez'in "Tüm Şubeler" görünümünün (bkz. app/api/hq/students)
 * tek-tenant karşılığı; ayrıca Sınıf Atama ekranının veri kaynağıdır
 * (classroomId null olan öğrenciler "atanmamış" sayılır).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci listesini görüntüleyemez" }, { status: 403 });
  }

  // Varsayılan olarak yalnızca AKTİF öğrenciler döner; arşivlenenler (pasife
  // alınmış, User.isActive=false) gizlenir. `?includeArchived=1` ile arşiv
  // görünümü için hepsi döner (her satırda `archived` alanıyla).
  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";

  const students = await withBranchTenantContext(actor, (tx) =>
    tx.studentProfile.findMany({
      where: includeArchived ? undefined : { user: { isActive: true } },
      include: {
        user: true,
        classroom: true,
        guardians: { include: { parent: { include: { user: true } } } },
      },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  return NextResponse.json({
    students: students.map((s) => {
      const guardianRow = s.guardians.find((g) => g.isBillingResponsible) ?? s.guardians[0];
      const guardianUser = guardianRow?.parent.user;
      return {
        id: s.id,
        studentNo: s.studentNo,
        name: `${s.user.firstName} ${s.user.lastName}`,
        gradeLevel: s.gradeLevel,
        classroomId: s.classroomId,
        classroomName: s.classroom?.name ?? null,
        guardianName: guardianUser ? `${guardianUser.firstName} ${guardianUser.lastName}` : null,
        guardianPhone: guardianUser?.phone ?? null,
        archived: !s.user.isActive,
      };
    }),
  });
}
