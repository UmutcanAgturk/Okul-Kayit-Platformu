import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { mentorMonthlyQuota } from "@/lib/mentor";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Seviye Mentör randevu talepleri — bir öğrencinin taleplerini listeler (GET)
 * ve yeni bir talep oluşturur (POST, STUDENT kendisi ya da PARENT velisi
 * olduğu öğrenci için). PtaMeetingRequest'in aksine öğretmen SEÇİLMEZ —
 * öğrencinin zaten atanmış mentörüne (bkz. app/api/students/[studentId]/mentor)
 * gönderilir, ve demo'daki gibi aylık kota kontrolü yapılır.
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

    const requests = await tx.mentorRequest.findMany({
      where: { studentId: student.id },
      include: { mentorTeacher: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      kind: "ok" as const,
      requests: requests.map((r) => ({
        id: r.id,
        mentorTeacherId: r.mentorTeacherId,
        mentorName: `${r.mentorTeacher.user.firstName} ${r.mentorTeacher.user.lastName}`,
        requestedAt: r.requestedAt.toISOString(),
        note: r.note,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin mentör taleplerini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca öğrenci veya velisi mentör randevusu talep edebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const requestedAt = typeof body.requestedAt === "string" ? new Date(body.requestedAt) : null;
  if (!requestedAt || Number.isNaN(requestedAt.getTime())) {
    return NextResponse.json({ message: "Geçerli bir requestedAt (ISO tarih) zorunludur" }, { status: 400 });
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

    if (!student.mentorTeacherId) {
      return { kind: "no_mentor" as const };
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const usedThisMonth = await tx.mentorRequest.count({
      where: { studentId: student.id, status: { not: "REDDEDILDI" }, createdAt: { gte: monthStart } },
    });
    const limit = mentorMonthlyQuota(student.gradeLevel);
    if (usedThisMonth >= limit) {
      return { kind: "quota_exceeded" as const, limit };
    }

    const created = await tx.mentorRequest.create({
      data: {
        tenantId: actor.tenantId!,
        studentId: student.id,
        mentorTeacherId: student.mentorTeacherId,
        requestedAt,
        note,
        requestedByUserId: actor.id,
      },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Mentör randevusu talep edildi",
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
  if (outcome.kind === "no_mentor") {
    return NextResponse.json({ message: "Bu öğrenciye henüz bir mentör atanmadı" }, { status: 409 });
  }
  if (outcome.kind === "quota_exceeded") {
    return NextResponse.json({ message: `Bu ay için mentör randevusu kotanız (${outcome.limit}) doldu` }, { status: 409 });
  }
  return NextResponse.json({ request: outcome.request }, { status: 201 });
}
