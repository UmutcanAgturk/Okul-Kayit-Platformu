import { NextRequest, NextResponse } from "next/server";
import { EnrollmentType, GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Normal Kayıt / Ön Kayıt — Enrollment modeli şemada baştan beri vardı
 * (bkz. prisma/schema.prisma, RLS'i de migration 20260721154601'de zaten
 * etkindi) ama hiçbir zaman buna karşı çalışan bir API yoktu; demo/
 * seviye360-app.html'deki CRM/Ön Kayıt/Normal Kayıt ekranları yalnızca
 * localStorage üzerinde çalışıyordu. Bu route, bir adayı (henüz gerçek bir
 * StudentProfile/User olmadan) tenant'a kaydeder — asıl User/StudentProfile/
 * taksit planı `[enrollmentId]/complete`'te oluşturulur.
 *
 * SUPERADMIN kasıtlı olarak dışarıda: diğer `/api/branch/...` route'larıyla
 * aynı gerekçe (tek bir şubeyi hedefler).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const VALID_STAGES = ["ON_KAYIT_ALINDI", "SOZLESME_BEKLENIYOR", "ODEME_PLANI_OLUSTURULDU", "KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol kayıt adaylarını görüntüleyemez" }, { status: 403 });
  }

  const stage = request.nextUrl.searchParams.get("stage");
  if (stage && !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ message: `stage şunlardan biri olmalıdır: ${VALID_STAGES.join(", ")}` }, { status: 400 });
  }

  const enrollments = await withTenantContext(actor, (tx) =>
    tx.enrollment.findMany({
      where: stage ? { stage: stage as any } : undefined,
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({ enrollments });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol kayıt adayı oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type === "ON_KAYIT" || body.type === "NORMAL_KAYIT" ? (body.type as EnrollmentType) : null;
  const candidateFullName = typeof body.candidateFullName === "string" && body.candidateFullName.trim() ? body.candidateFullName.trim() : null;
  const candidateGradeLevel = typeof body.candidateGradeLevel === "string" && body.candidateGradeLevel in GradeLevel ? (body.candidateGradeLevel as GradeLevel) : null;
  const guardianFullName = typeof body.guardianFullName === "string" && body.guardianFullName.trim() ? body.guardianFullName.trim() : null;
  const guardianPhone = typeof body.guardianPhone === "string" && body.guardianPhone.trim() ? body.guardianPhone.trim() : null;
  const targetClassroomId = typeof body.targetClassroomId === "string" && body.targetClassroomId ? body.targetClassroomId : null;
  const depositAmount = typeof body.depositAmount === "number" && body.depositAmount > 0 ? body.depositAmount : null;

  if (!type || !candidateFullName || !candidateGradeLevel || !guardianFullName || !guardianPhone) {
    return NextResponse.json(
      { message: "type (ON_KAYIT/NORMAL_KAYIT), candidateFullName, candidateGradeLevel, guardianFullName ve guardianPhone zorunludur" },
      { status: 400 },
    );
  }

  const enrollment = await withTenantContext(actor, async (tx) => {
    if (targetClassroomId) {
      const classroom = await tx.classroom.findUnique({ where: { id: targetClassroomId } });
      if (!classroom) return null;
    }
    const created = await tx.enrollment.create({
      data: {
        tenantId: actor.tenantId!,
        type,
        candidateFullName,
        candidateGradeLevel,
        guardianFullName,
        guardianPhone,
        targetClassroomId,
        depositAmount,
      },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kayıt adayı eklendi",
      detail: `${created.candidateFullName} — ${type === "ON_KAYIT" ? "Ön Kayıt" : "Normal Kayıt"}`,
    });

    return created;
  });

  if (!enrollment) {
    return NextResponse.json({ message: "targetClassroomId bu şubede bulunamadı" }, { status: 400 });
  }
  return NextResponse.json({ enrollment }, { status: 201 });
}
