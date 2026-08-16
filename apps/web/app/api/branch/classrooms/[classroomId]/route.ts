import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { gradeClassroomPrefix } from "@/lib/grade-tier";

const MANAGE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function PATCH(request: NextRequest, { params }: { params: { classroomId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const suffix = typeof body.suffix === "string" ? body.suffix.trim().toUpperCase().slice(0, 3) : undefined;
  const capacity =
    body.capacity !== undefined && Number.isFinite(Number(body.capacity)) && Number(body.capacity) > 0
      ? Math.floor(Number(body.capacity))
      : undefined;

  try {
    const outcome = await withBranchTenantContext(actor, async (tx) => {
      const existing = await tx.classroom.findUnique({ where: { id: params.classroomId } });
      if (!existing) return { kind: "not_found" as const };

      let name: string | undefined;
      if (suffix) {
        const prefix = gradeClassroomPrefix(existing.gradeLevel);
        if (prefix) name = `${prefix}-${suffix}`;
      }

      const updated = await tx.classroom.update({
        where: { id: existing.id },
        data: { name, capacity },
        include: { _count: { select: { students: true } } },
      });
      return { kind: "updated" as const, classroom: updated };
    });

    if (outcome.kind === "not_found") {
      return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({
      classroom: {
        id: outcome.classroom.id,
        name: outcome.classroom.name,
        gradeLevel: outcome.classroom.gradeLevel,
        capacity: outcome.classroom.capacity,
        studentCount: outcome.classroom._count.students,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu şube kodu zaten var" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { classroomId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf silemez" }, { status: 403 });
  }

  try {
    const outcome = await withBranchTenantContext(actor, async (tx) => {
      const existing = await tx.classroom.findUnique({
        where: { id: params.classroomId },
        include: { _count: { select: { students: true } } },
      });
      if (!existing) return { kind: "not_found" as const };
      if (existing._count.students > 0) return { kind: "occupied" as const };
      await tx.classroom.delete({ where: { id: existing.id } });
      return { kind: "deleted" as const };
    });

    if (outcome.kind === "not_found") {
      return NextResponse.json({ message: "Sınıf bulunamadı" }, { status: 404 });
    }
    if (outcome.kind === "occupied") {
      return NextResponse.json({ message: "Sınıfta öğrenci varken silinemez" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2003") {
      return NextResponse.json({ message: "Bu sınıfa bağlı ders programı/yoklama kayıtları var, önce onları kaldırın" }, { status: 409 });
    }
    throw e;
  }
}
