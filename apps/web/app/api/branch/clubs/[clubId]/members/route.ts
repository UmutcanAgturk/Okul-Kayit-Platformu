import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Bir kulübe öğrenci ekler/çıkarır (toggle) — demo'daki
 * `toggleClubMembership()`'in gerçek karşılığı. Yalnızca BRANCH_ADMIN veya
 * o kulübün danışmanı olan TEACHER çağırabilir.
 */
export async function POST(request: NextRequest, { params }: { params: { clubId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  if (!studentId) {
    return NextResponse.json({ message: "studentId zorunludur" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const club = await tx.club.findUnique({ where: { id: params.clubId } });
    if (!club) return { kind: "not_found" as const };

    let authorized = actor.role === UserRole.BRANCH_ADMIN;
    if (!authorized && actor.role === UserRole.TEACHER) {
      const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
      authorized = !!teacherProfile && club.advisorTeacherId === teacherProfile.id;
    }
    if (!authorized) return { kind: "forbidden" as const };

    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) return { kind: "student_not_found" as const };

    const existing = await tx.clubMembership.findUnique({
      where: { clubId_studentId: { clubId: club.id, studentId } },
    });
    if (existing) {
      await tx.clubMembership.delete({ where: { clubId_studentId: { clubId: club.id, studentId } } });
      return { kind: "removed" as const };
    }
    await tx.clubMembership.create({ data: { clubId: club.id, studentId } });
    return { kind: "added" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kulüp bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Bu kulübü yönetme yetkiniz yok" }, { status: 403 });
  }
  if (outcome.kind === "student_not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ isMember: outcome.kind === "added" });
}
