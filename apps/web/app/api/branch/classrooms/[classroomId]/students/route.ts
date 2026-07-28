import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const ROLES_ALLOWED: UserRole[] = [UserRole.TEACHER, UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

/**
 * Bir sınıfın öğrenci listesi — Disiplin kaydı eklerken "hangi öğrenci için?"
 * seçicisini doldurmak için (bkz. app/api/branch/discipline). Devamsızlık
 * kendi roster'ını /api/branch/attendance içinde tarih bazlı döndürüyor;
 * burada tarihten bağımsız, sade bir liste yeterli.
 */
export async function GET(request: NextRequest, { params }: { params: { classroomId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol sınıf öğrenci listesini görüntüleyemez" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const classroom = await tx.classroom.findUnique({ where: { id: params.classroomId } });
    if (!classroom) return { kind: "not_found" as const };

    const students = await tx.studentProfile.findMany({
      where: { classroomId: params.classroomId },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    });
    return {
      kind: "ok" as const,
      students: students.map((s) => ({ studentId: s.id, name: `${s.user.firstName} ${s.user.lastName}` })),
    };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ students: outcome.students });
}
