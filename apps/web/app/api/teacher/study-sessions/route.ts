import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

// Oturumdaki öğretmenin kendi etüt seanslarını listeler.
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi etüt seanslarını listeleyebilir" }, { status: 403 });
  }

  const sessions = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];
    return tx.studySession.findMany({
      where: { teacherId: teacherProfile.id },
      orderBy: { scheduledStart: "asc" },
      include: { achievement: true, student: true },
    });
  });

  return NextResponse.json({ sessions });
}
