import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Veli-Öğretmen Görüşme Randevusu — bir öğrencinin görüşme taleplerini
 * listeler (GET) ve yeni bir talep oluşturur (POST). Yetki kontrolü
 * Devamsızlık/Disiplin ile birebir aynıdır (bkz. o modüllerdeki not),
 * ancak POST demo'daki "guardianOnly" ekranını yansıtarak yalnızca PARENT
 * rolüne açıktır — öğretmenle görüşme talep etmek velinin işidir.
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

    const requests = await tx.ptaMeetingRequest.findMany({
      where: { studentId: student.id },
      include: { teacher: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      kind: "ok" as const,
      studentId: student.id,
      requests: requests.map((r) => ({
        id: r.id,
        teacherId: r.teacherId,
        teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
        requestedAt: r.requestedAt.toISOString(),
        topic: r.topic,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin görüşme taleplerini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca veliler görüşme talebi oluşturabilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teacherId = typeof body.teacherId === "string" && body.teacherId ? body.teacherId : null;
  const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : null;
  const requestedAt = typeof body.requestedAt === "string" ? new Date(body.requestedAt) : null;

  if (!teacherId || !requestedAt || Number.isNaN(requestedAt.getTime())) {
    return NextResponse.json({ message: "teacherId ve geçerli bir requestedAt (ISO tarih) zorunludur" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
    const guardianRow = parentProfile
      ? await tx.studentGuardian.findUnique({
          where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
        })
      : null;
    if (!guardianRow) return { kind: "forbidden" as const };

    // TeacherProfile'da tenantId kolonu yok — bkz. app/api/branch/teachers
    // route'undaki not. Aynı desenle User.tenantId üzerinden filtrelenir.
    const teacher = await tx.teacherProfile.findFirst({
      where: { id: teacherId, user: { tenantId: actor.tenantId!, role: UserRole.TEACHER } },
    });
    if (!teacher) return { kind: "teacher_not_found" as const };

    const created = await tx.ptaMeetingRequest.create({
      data: {
        tenantId: actor.tenantId!,
        studentId: student.id,
        teacherId: teacher.id,
        requestedAt,
        topic,
        requestedByUserId: actor.id,
      },
    });
    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Veli görüşmesi talep edildi",
      detail: requestedAt.toLocaleDateString("tr-TR"),
    });
    return { kind: "created" as const, request: created };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Yalnızca kendi velisi olduğunuz öğrenci için talep oluşturabilirsiniz" }, { status: 403 });
  }
  if (outcome.kind === "teacher_not_found") {
    return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ request: outcome.request }, { status: 201 });
}
