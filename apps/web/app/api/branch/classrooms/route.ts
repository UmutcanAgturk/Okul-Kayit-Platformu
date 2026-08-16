import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Yoklama (Devamsızlık) ekranındaki sınıf seçicisini doldurur — öğretmenin
 * hangi sınıflara yoklama alabileceğini belirlemek için (bkz. app/api/branch/attendance).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.TEACHER, UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf listesini görüntüleyemez" }, { status: 403 });
  }

  const classrooms = await withBranchTenantContext(actor, (tx) =>
    tx.classroom.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
  );

  return NextResponse.json({
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      studentCount: c._count.students,
    })),
  });
}
