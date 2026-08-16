import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Kurum (tenant) genelindeki tüm Veli-Öğretmen Görüşme taleplerinin salt
 * okunur listesi — demo'daki "branch:veligorusme" ekranının karşılığı.
 * `PtaMeetingRequest` yalnızca düz `tenant_isolation` taşır (bkz.
 * prisma/schema.prisma) — Devamsızlık/Disiplin ile aynı desen.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol görüşme taleplerini görüntüleyemez" }, { status: 403 });
  }

  const requests = await withBranchTenantContext(actor, (tx) =>
    tx.ptaMeetingRequest.findMany({
      include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      teacherId: r.teacherId,
      teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
      requestedAt: r.requestedAt.toISOString(),
      topic: r.topic,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
