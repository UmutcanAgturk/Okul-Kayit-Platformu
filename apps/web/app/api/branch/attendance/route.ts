import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";

/**
 * Devamsızlık/Yoklama — demo/seviye360-app.html'deki "teacher:attendance" /
 * "branch:attendance" ekranlarının gerçek karşılığı. `AttendanceRecord`
 * yalnızca düz `tenant_isolation` taşır (bkz. prisma/schema.prisma) — bu
 * route hangi ROLLERİN erişebileceğini (TEACHER/BRANCH_ADMIN/
 * GUIDANCE_COORDINATOR), ayrı bir route (app/api/students/[studentId]/attendance)
 * ise STUDENT/PARENT'ın yalnızca KENDİ kaydını görebilmesini uygular.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.TEACHER, UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const STATUSES: AttendanceStatus[] = [
  AttendanceStatus.VAR,
  AttendanceStatus.GEC,
  AttendanceStatus.IZINLI,
  AttendanceStatus.YOK,
];

function parseDateOnly(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol yoklama görüntüleyemez" }, { status: 403 });
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId");
  const date = parseDateOnly(request.nextUrl.searchParams.get("date"));
  if (!classroomId || !date) {
    return NextResponse.json({ message: "classroomId ve date (YYYY-MM-DD) zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) return { kind: "not_found" as const };

    const students = await tx.studentProfile.findMany({
      where: { classroomId },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    });
    const records = await tx.attendanceRecord.findMany({ where: { classroomId, date } });
    const recordByStudentId = new Map(records.map((r) => [r.studentId, r]));

    return {
      kind: "ok" as const,
      students: students.map((s) => {
        const record = recordByStudentId.get(s.id);
        return {
          studentId: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          status: record?.status ?? AttendanceStatus.VAR,
          note: record?.note ?? null,
        };
      }),
    };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ classroomId, date: date.toISOString().slice(0, 10), students: outcome.students });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol yoklama kaydedemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null;
  const date = parseDateOnly(body.date);
  const records = Array.isArray(body.records) ? body.records : null;

  if (!classroomId || !date || !records || records.length === 0) {
    return NextResponse.json(
      { message: "classroomId, date (YYYY-MM-DD) ve en az bir kayıt içeren records zorunludur" },
      { status: 400 },
    );
  }
  for (const r of records) {
    if (typeof r?.studentId !== "string" || !r.studentId || !STATUSES.includes(r.status)) {
      return NextResponse.json({ message: "Her kayıt için geçerli bir studentId ve status zorunludur" }, { status: 400 });
    }
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) return { kind: "not_found" as const };

    const studentIds: string[] = records.map((r: { studentId: string }) => r.studentId);
    const students = await tx.studentProfile.findMany({ where: { id: { in: studentIds } } });
    const studentClassroomById = new Map(students.map((s) => [s.id, s.classroomId]));
    for (const studentId of studentIds) {
      if (studentClassroomById.get(studentId) !== classroomId) {
        return { kind: "student_mismatch" as const, studentId };
      }
    }

    for (const r of records as { studentId: string; status: AttendanceStatus; note?: string }[]) {
      await tx.attendanceRecord.upsert({
        where: { studentId_date: { studentId: r.studentId, date } },
        create: {
          tenantId: effectiveTenantId(actor),
          studentId: r.studentId,
          classroomId,
          date,
          status: r.status,
          note: r.note?.trim() || null,
          recordedByUserId: actor.id,
        },
        update: { status: r.status, note: r.note?.trim() || null, recordedByUserId: actor.id },
      });
    }

    // 3. denetim bulgusu — demo'nun "Yoklama kaydedildi" olayının karşılığı
    // Aktivite Akışı'nda hiç yoktu.
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Yoklama kaydedildi",
      detail: `${classroom.name} — ${date.toISOString().slice(0, 10)} — ${records.length} öğrenci`,
    });

    // Devamsız (YOK) işaretlenen öğrenciler için veli bildirimi hazırla
    const absentIds = (records as { studentId: string; status: AttendanceStatus }[])
      .filter((r) => r.status === AttendanceStatus.YOK)
      .map((r) => r.studentId);
    let notifyList: { phone: string | null; email: string | null; name: string; studentName: string }[] = [];
    if (absentIds.length > 0) {
      const absentStudents = await tx.studentProfile.findMany({
        where: { id: { in: absentIds } },
        include: { user: true, guardians: { include: { parent: { include: { user: true } } } } },
      });
      notifyList = absentStudents.map((st) => {
        const billing = st.guardians.find((g) => g.isBillingResponsible) ?? st.guardians[0];
        const contact = billing ? billing.parent.user : st.user;
        return {
          phone: contact.phone,
          email: contact.email,
          name: contact.firstName,
          studentName: `${st.user.firstName} ${st.user.lastName}`,
        };
      });
    }

    return { kind: "saved" as const, notifyList, dateStr: date.toISOString().slice(0, 10), className: classroom.name };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "student_mismatch") {
    return NextResponse.json({ message: `Öğrenci (${outcome.studentId}) bu sınıfa ait değil` }, { status: 400 });
  }
  // Devamsızlık bildirimi — best-effort, ateşle-unut (bkz. lib/notifications.ts).
  if (outcome.kind === "saved" && outcome.notifyList.length > 0) {
    for (const t of outcome.notifyList) {
      void notify(t, {
        sms: `Sn. ${t.name}, ogrenciniz ${t.studentName} ${outcome.dateStr} tarihinde ${outcome.className} dersinde devamsiz gorunmektedir. Seviye 360`,
        emailSubject: "Devamsızlık Bildirimi — Seviye 360",
        emailText: `Sayın ${t.name},

Öğrenciniz ${t.studentName}, ${outcome.dateStr} tarihinde ${outcome.className} dersinde devamsız görünmektedir.

Seviye 360 Eğitim Kurumları`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
