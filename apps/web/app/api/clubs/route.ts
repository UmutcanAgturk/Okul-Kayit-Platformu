import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrencinin kendi tenant'ındaki tüm kulüpleri (katılmak için) listeler —
 * demo'daki "student:kulup" ekranının karşılığı. Demo'da bu ekran
 * guardianOnly DEĞİLDİR (bkz. seviye360-app.html screens[] tanımı) — veli de
 * çocuğu adına kulüp üyeliğini yönetebiliyordu. PARENT için studentId query
 * parametresi zorunludur (StudentDetailDrawer/diğer self-servis ekranlardaki
 * çoklu-çocuk seçici deseniyle aynı) ve StudentGuardian ile doğrulanır.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca öğrenci veya veli kulüp listesini görüntüleyebilir" }, { status: 403 });
  }

  const requestedStudentId = request.nextUrl.searchParams.get("studentId");

  const result = await withTenantContext(actor, async (tx) => {
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
    if (!studentProfile) return { clubs: [] };

    const clubs = await tx.club.findMany({
      include: { advisorTeacher: { include: { user: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    });
    const myMemberships = await tx.clubMembership.findMany({ where: { studentId: studentProfile.id } });
    const myClubIds = new Set(myMemberships.map((m) => m.clubId));

    return {
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        advisorName: c.advisorTeacher ? `${c.advisorTeacher.user.firstName} ${c.advisorTeacher.user.lastName}` : null,
        memberCount: c._count.members,
        isMember: myClubIds.has(c.id),
      })),
    };
  });

  if ("kind" in result && result.kind === "student_required") {
    return NextResponse.json({ message: "studentId zorunludur" }, { status: 400 });
  }
  if ("kind" in result && result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin velisi değilsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
