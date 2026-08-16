import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Ders Programı — demo/seviye360-app.html'deki "schedule" ekranının gerçek
 * karşılığı, TÜM portallarda `restricted` işareti olmadan görünür (HQ hariç
 * — SUPERADMIN'in tek bir tenantId'si olmadığından bu route'a dahil değil).
 * Devamsızlık/Classroom ile aynı desen: yalnızca tenant_isolation, rol bazlı
 * DB kısıtlaması yok — bir okul programı normalde herkese açıktır. Yazma
 * (POST/DELETE) yalnızca BRANCH_ADMIN'e açık.
 */
const WRITE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!actor.tenantId) {
    return NextResponse.json({ slots: [] });
  }

  const slots = await withTenantContext(actor, (tx) =>
    tx.timetableSlot.findMany({
      include: { classroom: true, teacher: { include: { user: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  );

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      classroomId: s.classroomId,
      classroomName: s.classroom.name,
      teacherId: s.teacherId,
      teacherName: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
      subject: s.subject,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol ders programına ekleme yapamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null;
  const teacherId = typeof body.teacherId === "string" && body.teacherId ? body.teacherId : null;
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const dayOfWeek = typeof body.dayOfWeek === "number" && body.dayOfWeek >= 0 && body.dayOfWeek <= 6 ? body.dayOfWeek : null;
  const startTime = typeof body.startTime === "string" && /^\d{2}:\d{2}$/.test(body.startTime) ? body.startTime : null;
  const endTime = typeof body.endTime === "string" && /^\d{2}:\d{2}$/.test(body.endTime) ? body.endTime : null;

  if (!classroomId || !teacherId || !subject || dayOfWeek === null || !startTime || !endTime) {
    return NextResponse.json(
      { message: "classroomId, teacherId, subject, dayOfWeek, startTime, endTime zorunludur" },
      { status: 400 },
    );
  }
  if (startTime >= endTime) {
    return NextResponse.json({ message: "startTime, endTime'dan önce olmalıdır" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) return { kind: "bad_classroom" as const };
    const teacher = await tx.teacherProfile.findUnique({ where: { id: teacherId } });
    if (!teacher) return { kind: "bad_teacher" as const };

    // Çakışma kontrolü: aynı sınıf VEYA aynı öğretmen, aynı gün, saatleri
    // örtüşen bir kayda zaten sahipse reddedilir (uygulama katmanında —
    // TimetableSlot'ta bunu garanti eden bir DB kısıtlaması yok).
    const sameDay = await tx.timetableSlot.findMany({
      where: { dayOfWeek, OR: [{ classroomId }, { teacherId }] },
    });
    const conflict = sameDay.find((s) => startTime < s.endTime && endTime > s.startTime);
    if (conflict) {
      return {
        kind: "conflict" as const,
        conflictType: conflict.classroomId === classroomId ? ("classroom" as const) : ("teacher" as const),
      };
    }

    const slot = await tx.timetableSlot.create({
      data: { tenantId: actor.tenantId!, classroomId, teacherId, subject, dayOfWeek, startTime, endTime },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ders programına eklendi",
      detail: `${classroom.name} — ${subject} (${["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][dayOfWeek]} ${startTime}-${endTime})`,
    });

    return { kind: "created" as const, slot };
  });

  if (outcome.kind === "bad_classroom") {
    return NextResponse.json({ message: "classroomId bu şubede bulunamadı" }, { status: 400 });
  }
  if (outcome.kind === "bad_teacher") {
    return NextResponse.json({ message: "teacherId bu şubede bulunamadı" }, { status: 400 });
  }
  if (outcome.kind === "conflict") {
    return NextResponse.json(
      {
        message:
          outcome.conflictType === "classroom"
            ? "Bu sınıfın bu gün/saatte zaten bir dersi var"
            : "Bu öğretmenin bu gün/saatte zaten bir dersi var",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ slot: outcome.slot }, { status: 201 });
}
