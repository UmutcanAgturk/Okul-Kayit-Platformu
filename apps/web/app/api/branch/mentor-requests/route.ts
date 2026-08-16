import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Kurum (tenant) genelindeki tüm Seviye Mentör randevu taleplerinin salt
 * okunur listesi — PtaMeetingRequest'in branch view'ıyla aynı desen.
 * `MentorRequest` yalnızca düz `tenant_isolation` taşır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol mentör randevu taleplerini görüntüleyemez" }, { status: 403 });
  }

  const requests = await withBranchTenantContext(actor, (tx) =>
    tx.mentorRequest.findMany({
      include: { student: { include: { user: true } }, mentorTeacher: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      mentorTeacherId: r.mentorTeacherId,
      mentorName: `${r.mentorTeacher.user.firstName} ${r.mentorTeacher.user.lastName}`,
      requestedAt: r.requestedAt.toISOString(),
      note: r.note,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
