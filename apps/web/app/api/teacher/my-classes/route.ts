import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Sınıflarım — demo/seviye360-app.html'deki "teacher:myclass" ekranının
 * gerçek karşılığı. Demo, öğretmenin sınıfını ayrı bir "atama" kavramından
 * (bu depoda hiç var olmayan bir alan) okuyordu; gerçek karşılığı olarak
 * öğretmenin Ders Programı'ndaki (bkz. app/api/branch/timetable) kayıtlı
 * olduğu TÜM sınıflar kullanılır — bir öğretmen birden fazla sınıfa ders
 * verebileceğinden demo'daki tekil "teacherClassroomLabel()" yerine
 * sınıf bazında gruplanmış bir liste döner.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi sınıflarını görüntüleyebilir" }, { status: 403 });
  }

  const classrooms = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return [];

    const slots = await tx.timetableSlot.findMany({
      where: { teacherId: teacherProfile.id },
      include: { classroom: true },
      distinct: ["classroomId"],
    });

    return Promise.all(
      slots.map(async (slot) => {
        const students = await tx.studentProfile.findMany({
          where: { classroomId: slot.classroomId },
          include: {
            user: true,
            examResults: { select: { netScore: true } },
            guardians: { include: { parent: { include: { user: true } } } },
          },
          orderBy: { user: { firstName: "asc" } },
        });

        return {
          classroomId: slot.classroomId,
          classroomName: slot.classroom.name,
          students: students.map((s) => {
            const guardianRow = s.guardians.find((g) => g.isBillingResponsible) ?? s.guardians[0];
            const guardianUser = guardianRow?.parent.user;
            const netAvg =
              s.examResults.length > 0
                ? Number((s.examResults.reduce((sum, r) => sum + r.netScore, 0) / s.examResults.length).toFixed(2))
                : null;
            return {
              studentId: s.id,
              studentNo: s.studentNo,
              name: `${s.user.firstName} ${s.user.lastName}`,
              netAvg,
              guardianName: guardianUser ? `${guardianUser.firstName} ${guardianUser.lastName}` : null,
              guardianPhone: guardianUser?.phone ?? null,
            };
          }),
        };
      }),
    );
  });

  return NextResponse.json({ classrooms });
}
