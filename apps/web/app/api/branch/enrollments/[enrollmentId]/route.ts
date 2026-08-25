import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * PATCH: bir kayıt adayının bilgilerini düzenler (demo'daki Ön Kayıt
 * listesindeki "Düzenle" satırının gerçek karşılığı) — DELETE: adayı iptal
 * eder (demo'daki "Sil"in karşılığı, ama Enrollment.stage zaten bir
 * IPTAL_EDILDI değeri tanımladığından — bkz. prisma/schema.prisma
 * EnrollmentStage — gerçek satır asla silinmez, StaffProfile/Tenant'taki
 * "deaktive et, asla silme" deseniyle aynı gerekçe: veli PII'sı ve olası
 * geçmiş görüşme kayıtları kaybolmamalı).
 *
 * Her iki işlem de yalnızca henüz KAYIT_TAMAMLANDI/IPTAL_EDILDI olmayan
 * adaylarda mümkündür — tamamlanmış bir kayıt zaten gerçek bir
 * User/StudentProfile'a bağlıdır, oradan düzenlenmelidir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const LOCKED_STAGES = ["KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];
const PROGRAM_TYPE_OPTIONS = ["Normal Kayıt", "Deneme Kulübü", "Yaz Kursu", "Kış Kursu"];

export async function PATCH(request: NextRequest, { params }: { params: { enrollmentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol kayıt adayını düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const candidateFullName = typeof body.candidateFullName === "string" && body.candidateFullName.trim() ? body.candidateFullName.trim() : undefined;
  const candidateGradeLevel = typeof body.candidateGradeLevel === "string" && body.candidateGradeLevel in GradeLevel ? (body.candidateGradeLevel as GradeLevel) : undefined;
  const guardianFullName = typeof body.guardianFullName === "string" && body.guardianFullName.trim() ? body.guardianFullName.trim() : undefined;
  const guardianPhone = typeof body.guardianPhone === "string" && body.guardianPhone.trim() ? body.guardianPhone.trim() : undefined;
  const targetClassroomId = body.targetClassroomId === null ? null : typeof body.targetClassroomId === "string" && body.targetClassroomId ? body.targetClassroomId : undefined;
  const programType = typeof body.programType === "string" && PROGRAM_TYPE_OPTIONS.includes(body.programType) ? body.programType : undefined;

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const enrollment = await tx.enrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.tenantId !== effectiveTenantId(actor)) {
      return { kind: "not_found" as const };
    }
    if (LOCKED_STAGES.includes(enrollment.stage)) {
      return { kind: "locked" as const, stage: enrollment.stage };
    }
    if (targetClassroomId) {
      const classroom = await tx.classroom.findUnique({ where: { id: targetClassroomId } });
      if (!classroom) return { kind: "bad_classroom" as const };
    }

    const updated = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { candidateFullName, candidateGradeLevel, guardianFullName, guardianPhone, targetClassroomId, programType },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kayıt adayı düzenlendi",
      detail: updated.candidateFullName,
    });

    return { kind: "updated" as const, enrollment: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kayıt adayı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "locked") {
    return NextResponse.json({ message: `"${outcome.stage}" durumundaki bir aday düzenlenemez` }, { status: 409 });
  }
  if (outcome.kind === "bad_classroom") {
    return NextResponse.json({ message: "targetClassroomId bu şubede bulunamadı" }, { status: 400 });
  }
  return NextResponse.json({ enrollment: outcome.enrollment });
}

export async function DELETE(request: NextRequest, { params }: { params: { enrollmentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol kayıt adayını iptal edemez" }, { status: 403 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const enrollment = await tx.enrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.tenantId !== effectiveTenantId(actor)) {
      return { kind: "not_found" as const };
    }
    if (LOCKED_STAGES.includes(enrollment.stage)) {
      return { kind: "locked" as const, stage: enrollment.stage };
    }
    const updated = await tx.enrollment.update({ where: { id: enrollment.id }, data: { stage: "IPTAL_EDILDI" } });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kayıt adayı iptal edildi",
      detail: updated.candidateFullName,
    });

    return { kind: "cancelled" as const, enrollment: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kayıt adayı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "locked") {
    return NextResponse.json({ message: `"${outcome.stage}" durumundaki bir aday tekrar iptal edilemez` }, { status: 409 });
  }
  return NextResponse.json({ enrollment: outcome.enrollment });
}
