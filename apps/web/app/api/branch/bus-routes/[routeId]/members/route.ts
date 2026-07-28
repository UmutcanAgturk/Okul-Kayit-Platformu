import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

/**
 * Bir öğrenciyi bir servis güzergahına atar/çıkarır (toggle). Kulüpler'in
 * aksine bir öğrenci en fazla BİR güzergaha binebilir (bkz. prisma/schema.prisma'daki
 * `StudentProfile.busRouteId` notu) — bu yüzden "Ekle" öğrenciyi varsa
 * önceki güzergahından otomatik çıkarıp bu güzergaha taşır.
 */
export async function POST(request: NextRequest, { params }: { params: { routeId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol servis güzergahı yönetemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  if (!studentId) {
    return NextResponse.json({ message: "studentId zorunludur" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const route = await tx.busRoute.findUnique({ where: { id: params.routeId } });
    if (!route) return { kind: "not_found" as const };

    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) return { kind: "student_not_found" as const };

    if (student.busRouteId === route.id) {
      await tx.studentProfile.update({ where: { id: studentId }, data: { busRouteId: null } });
      return { kind: "removed" as const };
    }
    await tx.studentProfile.update({ where: { id: studentId }, data: { busRouteId: route.id } });
    return { kind: "added" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Güzergah bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "student_not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ isMember: outcome.kind === "added" });
}
