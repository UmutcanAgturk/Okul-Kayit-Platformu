import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

// Oturumdaki öğretmenin danışmanı olduğu kulüpleri listeler — demo'daki
// "teacher:kulup" ekranının karşılığı.
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi kulüplerini listeleyebilir" }, { status: 403 });
  }

  const clubs = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];
    return tx.club.findMany({
      where: { advisorTeacherId: teacherProfile.id },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    });
  });

  return NextResponse.json({
    clubs: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      memberCount: c._count.members,
    })),
  });
}
