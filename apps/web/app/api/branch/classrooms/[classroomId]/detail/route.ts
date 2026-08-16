import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

const READ_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

/**
 * Sınıf Detayı — demo/seviye360-app.html'deki "Sınıfa Gir" (renderClassroomDetailHtml)
 * ekranının gerçek karşılığı: roster + haftalık ders planı (TimetableSlot'tan
 * türetilen "Dersin Öğretmenleri" listesi dahil). Yeni bir Prisma modeli
 * EKLEMEZ — mevcut StudentProfile ve TimetableSlot verisini birleştirir.
 */
export async function GET(request: NextRequest, { params }: { params: { classroomId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!READ_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf detayını görüntüleyemez" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    const classroom = await tx.classroom.findUnique({ where: { id: params.classroomId } });
    if (!classroom) return null;

    const students = await tx.studentProfile.findMany({
      where: { classroomId: classroom.id },
      include: { user: true, guardians: { include: { parent: { include: { user: true } } } } },
      orderBy: { user: { firstName: "asc" } },
    });

    const slots = await tx.timetableSlot.findMany({
      where: { classroomId: classroom.id },
      include: { teacher: { include: { user: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const teachersBySubject = new Map<string, string>();
    for (const slot of slots) {
      if (!teachersBySubject.has(slot.subject)) {
        teachersBySubject.set(slot.subject, `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`);
      }
    }

    return {
      classroom: { id: classroom.id, name: classroom.name, gradeLevel: classroom.gradeLevel, capacity: classroom.capacity },
      students: students.map((s) => {
        const guardianRow = s.guardians.find((g) => g.isBillingResponsible) ?? s.guardians[0];
        const guardianUser = guardianRow?.parent.user;
        return {
          id: s.id,
          studentNo: s.studentNo,
          name: `${s.user.firstName} ${s.user.lastName}`,
          guardianName: guardianUser ? `${guardianUser.firstName} ${guardianUser.lastName}` : null,
          guardianPhone: guardianUser?.phone ?? null,
        };
      }),
      subjectTeachers: Array.from(teachersBySubject.entries()).map(([subject, teacherName]) => ({ subject, teacherName })),
      weeklyPlan: slots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        teacherName: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
      })),
    };
  });

  if (!result) {
    return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(result);
}
