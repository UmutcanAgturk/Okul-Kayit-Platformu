import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Bir öğrencinin servis güzergahını döner (salt okunur) — demo'daki
 * "student:servis" ekranının karşılığı. Atama yalnızca BRANCH_ADMIN
 * tarafından yapılır (bkz. app/api/branch/bus-routes/[routeId]/members) —
 * Kulüpler'in aksine öğrenci/veli kendi kendine katılamaz/ayrılamaz. Yetki
 * kontrolü Devamsızlık/Disiplin/PTA ile birebir aynıdır.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { busRoute: true } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    return {
      kind: "ok" as const,
      route: student.busRoute
        ? {
            id: student.busRoute.id,
            name: student.busRoute.name,
            driverName: student.busRoute.driverName,
            driverPhone: student.busRoute.driverPhone,
            stops: student.busRoute.stops,
          }
        : null,
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin servis bilgisini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
