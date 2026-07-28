import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrencinin kendi tenant'ındaki tüm kulüpleri (katılmak için) listeler —
 * demo'daki "student:kulup" ekranının karşılığı.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT) {
    return NextResponse.json({ message: "Yalnızca öğrenciler kulüp listesini görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const studentProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!studentProfile) return { clubs: [] };

    const clubs = await tx.club.findMany({
      include: { advisorTeacher: { include: { user: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    });
    const myMemberships = await tx.clubMembership.findMany({ where: { studentId: studentProfile.id } });
    const myClubIds = new Set(myMemberships.map((m) => m.clubId));

    return {
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        advisorName: c.advisorTeacher ? `${c.advisorTeacher.user.firstName} ${c.advisorTeacher.user.lastName}` : null,
        memberCount: c._count.members,
        isMember: myClubIds.has(c.id),
      })),
    };
  });

  return NextResponse.json(result);
}
