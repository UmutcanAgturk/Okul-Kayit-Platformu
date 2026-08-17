import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";
import { mentorMonthlyQuota } from "@/lib/mentor";

// Oturumdaki mentör öğretmenin kendisine atanmış öğrencileri (mentilerini)
// listeler — demo'daki mentorTeacherMentees() ile birebir aynı.
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi mentilerini listeleyebilir" }, { status: 403 });
  }

  const mentees = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];
    return tx.studentProfile.findMany({
      where: { mentorTeacherId: teacherProfile.id },
      include: { user: true, classroom: true },
      orderBy: { user: { firstName: "asc" } },
    });
  });

  return NextResponse.json({
    mentees: mentees.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      gradeLevel: s.gradeLevel,
      classroomName: s.classroom?.name ?? null,
      quotaLimit: mentorMonthlyQuota(s.gradeLevel),
    })),
  });
}
