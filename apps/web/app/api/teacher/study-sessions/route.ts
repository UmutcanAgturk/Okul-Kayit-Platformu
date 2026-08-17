import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";
import { resolveTeacherProfile } from "@/lib/hq-teacher";

// Oturumdaki öğretmenin kendi etüt seanslarını listeler. Genel Merkez
// ?asTeacherId= ile bir öğretmen seçip "gibi" görüntüleyebilir (bkz. lib/hq-teacher.ts).
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER && actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca öğretmenler kendi etüt seanslarını listeleyebilir" }, { status: 403 });
  }

  const asTeacherId = request.nextUrl.searchParams.get("asTeacherId");
  const sessions = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await resolveTeacherProfile(actor, tx, asTeacherId);
    if (!teacherProfile) return [];
    return tx.studySession.findMany({
      where: { teacherId: teacherProfile.id },
      orderBy: { scheduledStart: "asc" },
      include: { achievement: true, student: { include: { user: true } } },
    });
  });

  // Ham Prisma nesnesi yerine seçilmiş alanlar döndürülür — aksi halde
  // student.user.passwordHash gibi hassas alanlar da istemciye sızardı.
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      student: {
        id: s.student.id,
        user: { firstName: s.student.user.firstName, lastName: s.student.user.lastName },
      },
      achievement: s.achievement ? { code: s.achievement.code, label: s.achievement.label } : null,
      note: s.note,
    })),
  });
}
