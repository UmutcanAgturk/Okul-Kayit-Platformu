import { NextRequest, NextResponse } from "next/server";
import { StudySessionSource, StudySessionStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * "Etüt Randevularım" — demo/seviye360-app.html'deki "student:etut" ekranının
 * öğrenci/veli tarafı. Öğretmen tarafı (onay/red/tamamlandı) zaten
 * app/api/teacher/study-sessions(+/[id]/respond) ile GERÇEKti; burada
 * öğrencinin KENDİ (veya velisi olduğu öğrencinin) StudySession kayıtlarını
 * listelemesi (GET) ve yeni bir talep oluşturması (POST) eklenir —
 * /api/students/[studentId]/mentor ile aynı yetki deseni.
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

/**
 * Öğrencinin (veya velisinin) kendi etüt talebini oluşturması —
 * demo'daki "student:etut" ekranının talep formunun gerçek karşılığı.
 * Yalnızca STUDENT/PARENT oluşturabilir (personel kendi onay/red akışını
 * kullanır, bkz. respond route). Yeni bir durum eklenmez — mevcut
 * AI_SUGGESTED ("Onay Bekliyor") durumu kaynak-bağımsızdır, `source: MANUAL`
 * talebi öğretmenin önerdiği/AI'nın önerdiğinden ayırt eder.
 */
export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca öğrenci veya velisi etüt talebi oluşturabilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teacherId = typeof body.teacherId === "string" && body.teacherId ? body.teacherId : null;
  const achievementId = typeof body.achievementId === "string" && body.achievementId ? body.achievementId : null;
  const scheduledStart = typeof body.scheduledStart === "string" ? new Date(body.scheduledStart) : null;
  const scheduledEnd = typeof body.scheduledEnd === "string" ? new Date(body.scheduledEnd) : null;

  if (!teacherId || !achievementId || !scheduledStart || !scheduledEnd || isNaN(scheduledStart.getTime()) || isNaN(scheduledEnd.getTime())) {
    return NextResponse.json({ message: "teacherId, achievementId, scheduledStart, scheduledEnd zorunludur" }, { status: 400 });
  }
  if (scheduledEnd <= scheduledStart) {
    return NextResponse.json({ message: "Bitiş saati başlangıçtan sonra olmalıdır" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    }

    const teacher = await tx.teacherProfile.findFirst({ where: { id: teacherId, user: { tenantId: effectiveTenantId(actor) } } });
    if (!teacher) return { kind: "invalid_teacher" as const };
    const achievement = await tx.curriculumNode.findUnique({ where: { id: achievementId } });
    if (!achievement) return { kind: "invalid_achievement" as const };

    const session = await tx.studySession.create({
      data: {
        tenantId: effectiveTenantId(actor),
        studentId: student.id,
        teacherId: teacher.id,
        achievementId: achievement.id,
        scheduledStart,
        scheduledEnd,
        status: StudySessionStatus.AI_SUGGESTED,
        source: StudySessionSource.MANUAL,
      },
      include: { achievement: true, teacher: { include: { user: true } } },
    });
    return { kind: "created" as const, session };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrenci için etüt talebi oluşturamazsınız" }, { status: 403 });
  }
  if (outcome.kind === "invalid_teacher") {
    return NextResponse.json({ message: "Geçersiz öğretmen" }, { status: 400 });
  }
  if (outcome.kind === "invalid_achievement") {
    return NextResponse.json({ message: "Geçersiz kazanım" }, { status: 400 });
  }

  return NextResponse.json(
    {
      session: {
        id: outcome.session.id,
        status: outcome.session.status,
        scheduledStart: outcome.session.scheduledStart,
        scheduledEnd: outcome.session.scheduledEnd,
        teacherName: `${outcome.session.teacher.user.firstName} ${outcome.session.teacher.user.lastName}`,
        achievement: { code: outcome.session.achievement.code, label: outcome.session.achievement.label },
      },
    },
    { status: 201 },
  );
}
