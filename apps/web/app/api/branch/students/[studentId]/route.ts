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

  // Arşivleme (pasife alma) — "Öğrenci Kaydını Sil" yerine kullanılan güvenli,
  // geri alınabilir eylem: öğrenci kalıcı silinmez, User.isActive=false yapılır
  // (böylece giriş kapanır ve roster'da görünmez, bkz. GET filtresi), tüm
  // finansal/akademik kayıtları KORUNUR. `archived: false` ile geri alınır.
  if (typeof body.archived === "boolean") {
    const archived = body.archived as boolean;
    const result = await withBranchTenantContext(actor, async (tx) => {
      const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
      if (!student) return { kind: "not_found" as const };
      await tx.user.update({ where: { id: student.userId }, data: { isActive: !archived } });
      if (archived) {
        // Arşivlenen öğrencinin açık oturumları anında iptal edilir.
        await tx.userSession.updateMany({ where: { userId: student.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: archived ? "Öğrenci kaydı arşivlendi (pasife alındı)" : "Öğrenci kaydı arşivden geri alındı",
        detail: `${student.user.firstName} ${student.user.lastName} (${student.studentNo})`,
      });
      return { kind: "archived" as const, archived };
    });
    if (result.kind === "not_found") {
      return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({ studentId: params.studentId, archived: result.archived });
  }

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

  // task #91: öğrencinin KENDİ iletişim bilgisi + hedefi — demo'nun
  // openStudentDetail() düzenleme formundaki sd-edit-phone/sd-edit-email/
  // sd-edit-hedef alanlarının karşılığı (veli bilgisinden AYRI).
  const studentPhone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const studentEmail = typeof body.email === "string" ? body.email.trim() : undefined;
  const hasTargetGoalChange = "targetGoal" in body;
  const targetGoal = typeof body.targetGoal === "string" ? body.targetGoal.trim() || null : null;
  if (studentEmail !== undefined && !studentEmail.includes("@")) {
    return NextResponse.json({ message: "Geçerli bir e-posta girin" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
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
          // Tenant'a scope edilmiş kontrol (bkz. prisma/schema.prisma User.phone
          // yorumu — @@unique([tenantId, phone])) — başka bir şubede aynı
          // telefonun kayıtlı olup olmadığını bu sorgu ASLA açığa çıkarmaz.
          const phoneOwner = await tx.user.findFirst({ where: { phone: guardianPhone, tenantId: effectiveTenantId(actor) } });
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

      let studentPhoneOut: string | null = student.user.phone;
      let studentEmailOut: string = student.user.email;
      const hasStudentContactChange = studentPhone !== undefined || studentEmail !== undefined;
      if (hasStudentContactChange) {
        if (studentPhone !== undefined) {
          const phoneOwner = await tx.user.findFirst({ where: { phone: studentPhone, tenantId: effectiveTenantId(actor) } });
          if (phoneOwner && phoneOwner.id !== student.userId) return { kind: "student_phone_taken" as const };
        }
        if (studentEmail !== undefined) {
          const emailOwner = await tx.user.findUnique({ where: { email: studentEmail } });
          if (emailOwner && emailOwner.id !== student.userId) return { kind: "student_email_taken" as const };
        }
        const updatedStudentUser = await tx.user.update({
          where: { id: student.userId },
          data: { ...(studentPhone !== undefined ? { phone: studentPhone } : {}), ...(studentEmail !== undefined ? { email: studentEmail } : {}) },
        });
        studentPhoneOut = updatedStudentUser.phone;
        studentEmailOut = updatedStudentUser.email;
      }
      if (hasTargetGoalChange) {
        await tx.studentProfile.update({ where: { id: student.id }, data: { targetGoal } });
      }
      if (hasStudentContactChange || hasTargetGoalChange) {
        await logActivity(tx, {
          tenantId: effectiveTenantId(actor),
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Öğrenci iletişim bilgisi/hedefi güncellendi",
          detail: `${student.user.firstName} ${student.user.lastName}`,
        });
      }

      return {
        kind: "updated" as const,
        studentId: student.id,
        classroomId: newClassroomId,
        classroomName: hasClassroomChange ? classroomName : undefined,
        guardianName,
        guardianPhone: guardianPhoneOut,
        phone: studentPhoneOut,
        email: studentEmailOut,
        targetGoal: hasTargetGoalChange ? targetGoal : student.targetGoal,
      };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu telefon numarası başka bir kullanıcıda kayıtlı" }, { status: 409 });
    }
    throw e;
  }

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
  if (outcome.kind === "student_phone_taken") {
    return NextResponse.json({ message: "Bu telefon numarası başka bir kullanıcıda kayıtlı" }, { status: 409 });
  }
  if (outcome.kind === "student_email_taken") {
    return NextResponse.json({ message: "Bu e-posta başka bir kullanıcıda kayıtlı" }, { status: 409 });
  }
  return NextResponse.json({
    studentId: outcome.studentId,
    classroomId: outcome.classroomId,
    classroomName: outcome.classroomName,
    guardianName: outcome.guardianName,
    guardianPhone: outcome.guardianPhone,
    phone: outcome.phone,
    email: outcome.email,
    targetGoal: outcome.targetGoal,
  });
}

/**
 * DELETE ?permanent=true — demo'daki "Öğrenci Kaydını Sil" (kalıcı silme,
 * geri alınamaz) eyleminin gerçek karşılığı. `permanent=true` ZORUNLUDUR
 * (staff route'unun aksine öğrenciler için bir "devre dışı bırak" ara
 * durumu yoktur — bu route yalnızca kalıcı silmeyi destekler).
 *
 * StudentProfile'a bağlı BİRÇOK tablo (taksit, devamsızlık, sınav sonucu,
 * disiplin notu, vb. — bkz. prisma/schema.prisma) `onDelete: Cascade`
 * DEĞİLDİR (yalnızca StudentGuardian ve ClubMembership cascade'dir) —
 * bu yüzden staff route'undaki payrollCount deseniyle aynı mantıkla,
 * silmeden ÖNCE tüm bu tablolar açıkça sayılır; herhangi birinde kayıt
 * varsa 409 döner. Pratikte bu, yalnızca hiç geçmişi olmayan (örn. hatalı
 * toplu içe aktarımla eklenmiş) bir öğrenci için kalıcı silmeyi mümkün kılar.
 */
const ROLES_DELETE_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function DELETE(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_DELETE_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci kaydını silemez" }, { status: 403 });
  }
  if (request.nextUrl.searchParams.get("permanent") !== "true") {
    return NextResponse.json({ message: "Kalıcı silme için ?permanent=true zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
    if (!student) return { kind: "not_found" as const };

    const [
      attendance,
      discipline,
      pta,
      enrollment,
      examResults,
      achievements,
      quizAttempts,
      studySessions,
      installments,
      paymentMethods,
      paymentReceipts,
      promissoryNotes,
      mentorRequests,
    ] = await Promise.all([
      tx.attendanceRecord.count({ where: { studentId: student.id } }),
      tx.disciplineRecord.count({ where: { studentId: student.id } }),
      tx.ptaMeetingRequest.count({ where: { studentId: student.id } }),
      tx.enrollment.count({ where: { studentId: student.id } }),
      tx.examResult.count({ where: { studentId: student.id } }),
      tx.studentAchievementResult.count({ where: { studentId: student.id } }),
      tx.quizAttempt.count({ where: { studentId: student.id } }),
      tx.studySession.count({ where: { studentId: student.id } }),
      tx.paymentInstallment.count({ where: { studentId: student.id } }),
      tx.paymentMethod.count({ where: { studentId: student.id } }),
      tx.paymentReceipt.count({ where: { studentId: student.id } }),
      tx.promissoryNote.count({ where: { studentId: student.id } }),
      tx.mentorRequest.count({ where: { studentId: student.id } }),
    ]);
    const total =
      attendance + discipline + pta + enrollment + examResults + achievements + quizAttempts + studySessions + installments + paymentMethods + paymentReceipts + promissoryNotes + mentorRequests;
    if (total > 0) {
      return { kind: "has_history" as const };
    }

    await tx.studentProfile.delete({ where: { id: student.id } });
    await tx.user.delete({ where: { id: student.userId } });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Öğrenci kaydı kalıcı olarak silindi",
      detail: `${student.user.firstName} ${student.user.lastName} (${student.studentNo})`,
    });

    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "has_history") {
    return NextResponse.json(
      { message: "Bu öğrencinin taksit/devamsızlık/sınav vb. geçmiş kayıtları olduğu için kalıcı olarak silinemez." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
