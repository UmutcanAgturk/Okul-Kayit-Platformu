import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

// Oturumdaki mentör öğretmenin kendisine yöneltilen mentör randevu taleplerini listeler.
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi mentör taleplerini listeleyebilir" }, { status: 403 });
  }

  const requests = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];
    return tx.mentorRequest.findMany({
      where: { mentorTeacherId: teacherProfile.id },
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: true } } },
    });
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      requestedAt: r.requestedAt.toISOString(),
      note: r.note,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
