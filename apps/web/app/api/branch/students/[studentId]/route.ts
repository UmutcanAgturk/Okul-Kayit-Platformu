import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * PATCH: bir öğrenciyi bir şubeye (Classroom) atar veya ataması kaldırır
 * (classroomId: null) — demo'daki "Sınıf Atama" ekranının gerçek karşılığı.
 * Sınıf, öğrencinin kayıt sırasında sabitlenen gradeLevel'ıyla (bkz.
 * prisma/schema.prisma StudentProfile.gradeLevel yorumu) AYNI seviyede
 * olmalı — 9. sınıf bir öğrenci 10-A'ya atanamaz.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function PATCH(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol sınıf ataması yapamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.classroomId !== null && typeof body.classroomId !== "string") {
    return NextResponse.json({ message: "classroomId string veya null olmalı" }, { status: 400 });
  }
  const classroomId: string | null = body.classroomId;

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
    if (!student) return { kind: "not_found" as const };

    if (classroomId !== null) {
      const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
      if (!classroom) return { kind: "bad_classroom" as const };
      if (classroom.gradeLevel !== student.gradeLevel) {
        return { kind: "grade_mismatch" as const, classroomGrade: classroom.gradeLevel, studentGrade: student.gradeLevel };
      }
    }

    const updated = await tx.studentProfile.update({
      where: { id: student.id },
      data: { classroomId },
      include: { classroom: true },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: classroomId ? "Öğrenci sınıfa atandı" : "Öğrencinin sınıf ataması kaldırıldı",
      detail: `${student.user.firstName} ${student.user.lastName}${updated.classroom ? ` → ${updated.classroom.name}` : ""}`,
    });

    return { kind: "updated" as const, studentId: updated.id, classroomId: updated.classroomId, classroomName: updated.classroom?.name ?? null };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "bad_classroom") {
    return NextResponse.json({ message: "classroomId bu şubede bulunamadı" }, { status: 400 });
  }
  if (outcome.kind === "grade_mismatch") {
    return NextResponse.json(
      { message: `Sınıf seviyesi uyuşmuyor: öğrenci ${outcome.studentGrade}, sınıf ${outcome.classroomGrade}` },
      { status: 400 },
    );
  }
  return NextResponse.json({ studentId: outcome.studentId, classroomId: outcome.classroomId, classroomName: outcome.classroomName });
}
