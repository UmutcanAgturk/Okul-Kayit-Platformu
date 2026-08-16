import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * PATCH: bir öğrenciyi bir şubeye (Classroom) atar veya ataması kaldırır
 * (classroomId: null) — demo'daki "Sınıf Atama" ekranının gerçek karşılığı.
 * Sınıf, öğrencinin kayıt sırasında sabitlenen gradeLevel'ıyla (bkz.
 * prisma/schema.prisma StudentProfile.gradeLevel yorumu) AYNI seviyede
 * olmalı — 9. sınıf bir öğrenci 10-A'ya atanamaz.
 *
 * classroomId ile bağımsız olarak, gövdede guardianFullName/guardianPhone
 * verilirse (bkz. components/students-roster/StudentDetailDrawer.tsx —
 * demo'daki openStudentDetail çekmecesinin karşılığı) faturalamadan sorumlu
 * (veya ilk) velinin bağlı User kaydı güncellenir — StudentProfile'da veli
 * alanı YOKTUR, veli iletişim bilgisi StudentGuardian → ParentProfile → User
 * zincirinde yaşar.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function PATCH(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci kaydını düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hasClassroomChange = "classroomId" in body;
  if (hasClassroomChange && body.classroomId !== null && typeof body.classroomId !== "string") {
    return NextResponse.json({ message: "classroomId string veya null olmalı" }, { status: 400 });
  }
  const classroomId: string | null = body.classroomId ?? null;

  const guardianFullName = typeof body.guardianFullName === "string" ? body.guardianFullName.trim() : undefined;
  const guardianPhone = typeof body.guardianPhone === "string" ? body.guardianPhone.trim() : undefined;
  const hasGuardianChange = guardianFullName !== undefined || guardianPhone !== undefined;
  if (hasGuardianChange && (guardianFullName === "" || guardianPhone === "")) {
    return NextResponse.json({ message: "Veli adı ve telefonu boş olamaz" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: params.studentId },
      include: { user: true, guardians: { include: { parent: { include: { user: true } } } } },
    });
    if (!student) return { kind: "not_found" as const };

    let classroomName: string | null = null;
    let newClassroomId: string | null = student.classroomId;
    if (hasClassroomChange) {
      if (classroomId !== null) {
        const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
        if (!classroom) return { kind: "bad_classroom" as const };
        if (classroom.gradeLevel !== student.gradeLevel) {
          return { kind: "grade_mismatch" as const, classroomGrade: classroom.gradeLevel, studentGrade: student.gradeLevel };
        }
      }
      const updated = await tx.studentProfile.update({ where: { id: student.id }, data: { classroomId }, include: { classroom: true } });
      newClassroomId = updated.classroomId;
      classroomName = updated.classroom?.name ?? null;
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: classroomId ? "Öğrenci sınıfa atandı" : "Öğrencinin sınıf ataması kaldırıldı",
        detail: `${student.user.firstName} ${student.user.lastName}${classroomName ? ` → ${classroomName}` : ""}`,
      });
    }

    let guardianName: string | null = null;
    let guardianPhoneOut: string | null = null;
    if (hasGuardianChange) {
      const guardianRow = student.guardians.find((g) => g.isBillingResponsible) ?? student.guardians[0];
      if (!guardianRow) return { kind: "no_guardian" as const };
      if (guardianPhone !== undefined) {
        const phoneOwner = await tx.user.findUnique({ where: { phone: guardianPhone } });
        if (phoneOwner && phoneOwner.id !== guardianRow.parent.user.id) return { kind: "phone_taken" as const };
      }
      const data: { firstName?: string; lastName?: string; phone?: string } = {};
      if (guardianFullName !== undefined) {
        const [firstName, ...rest] = guardianFullName.split(/\s+/);
        data.firstName = firstName;
        data.lastName = rest.join(" ") || firstName;
      }
      if (guardianPhone !== undefined) data.phone = guardianPhone;
      const updatedUser = await tx.user.update({ where: { id: guardianRow.parent.user.id }, data });
      guardianName = `${updatedUser.firstName} ${updatedUser.lastName}`;
      guardianPhoneOut = updatedUser.phone;

      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "Veli iletişim bilgisi güncellendi",
        detail: `${student.user.firstName} ${student.user.lastName} — veli: ${guardianName}`,
      });
    }

    return {
      kind: "updated" as const,
      studentId: student.id,
      classroomId: newClassroomId,
      classroomName: hasClassroomChange ? classroomName : undefined,
      guardianName,
      guardianPhone: guardianPhoneOut,
    };
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
  if (outcome.kind === "no_guardian") {
    return NextResponse.json({ message: "Bu öğrencinin kayıtlı bir velisi yok" }, { status: 400 });
  }
  if (outcome.kind === "phone_taken") {
    return NextResponse.json({ message: "Bu telefon numarası başka bir kullanıcıda kayıtlı" }, { status: 409 });
  }
  return NextResponse.json({
    studentId: outcome.studentId,
    classroomId: outcome.classroomId,
    classroomName: outcome.classroomName,
    guardianName: outcome.guardianName,
    guardianPhone: outcome.guardianPhone,
  });
}
