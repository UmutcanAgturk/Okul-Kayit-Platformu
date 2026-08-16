import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

// Oturumdaki öğretmenin kendi ders programını listeler.
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi ders programını listeleyebilir" }, { status: 403 });
  }

  const slots = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];
    return tx.timetableSlot.findMany({
      where: { teacherId: teacherProfile.id },
      include: { classroom: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      subject: s.subject,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      classroomName: s.classroom.name,
    })),
  });
}
