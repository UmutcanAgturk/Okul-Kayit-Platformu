import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

// Öğrencinin (veya velisinin, çocuğu adına) kulüp üyeliğini açar/kapatır
// (join/leave) — demo'daki "Katıl"/"Ayrıl" butonunun karşılığı. PARENT için
// gövdede studentId zorunludur (bkz. ../../route.ts GET'teki aynı desen).
export async function POST(request: NextRequest, { params }: { params: { clubId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca öğrenci veya veli kulübe katılabilir/ayrılabilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedStudentId = typeof body.studentId === "string" ? body.studentId : null;

  const outcome = await withTenantContext(actor, async (tx) => {
    let studentProfile;
    if (actor.role === UserRole.STUDENT) {
      studentProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
    } else {
      if (!requestedStudentId) return { kind: "student_required" as const };
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({ where: { studentId_parentId: { studentId: requestedStudentId, parentId: parentProfile.id } } })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
      studentProfile = await tx.studentProfile.findUnique({ where: { id: requestedStudentId } });
    }
    if (!studentProfile) return { kind: "no_profile" as const };

    const club = await tx.club.findUnique({ where: { id: params.clubId } });
    if (!club) return { kind: "not_found" as const };

    const existing = await tx.clubMembership.findUnique({
      where: { clubId_studentId: { clubId: club.id, studentId: studentProfile.id } },
    });
    if (existing) {
      await tx.clubMembership.delete({ where: { clubId_studentId: { clubId: club.id, studentId: studentProfile.id } } });
      return { kind: "removed" as const };
    }
    await tx.clubMembership.create({ data: { clubId: club.id, studentId: studentProfile.id } });
    return { kind: "added" as const };
  });

  if (outcome.kind === "student_required") {
    return NextResponse.json({ message: "studentId zorunludur" }, { status: 400 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin velisi değilsiniz" }, { status: 403 });
  }
  if (outcome.kind === "no_profile" || outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kulüp bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ isMember: outcome.kind === "added" });
}
