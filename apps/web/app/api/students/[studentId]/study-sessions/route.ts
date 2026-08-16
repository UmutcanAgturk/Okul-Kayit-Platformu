import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * "Etüt Randevularım" — demo/seviye360-app.html'deki "student:etut" ekranının
 * öğrenci/veli tarafı. Öğretmen tarafı (onay/red) zaten
 * app/api/teacher/study-sessions(+/[id]/respond) ile GERÇEKti; burada
 * yalnızca öğrencinin KENDİ (veya velisi olduğu öğrencinin) StudySession
 * kayıtlarını salt-okunur listelemesi eklenir — /api/students/[studentId]/mentor
 * ile aynı yetki deseni.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const sessions = await tx.studySession.findMany({
      where: { studentId: student.id },
      orderBy: { scheduledStart: "desc" },
      include: { achievement: true, teacher: { include: { user: true } } },
    });

    return {
      kind: "ok" as const,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        teacherName: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
        achievement: { code: s.achievement.code, label: s.achievement.label },
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin etüt randevularını görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json({ sessions: result.sessions });
}
