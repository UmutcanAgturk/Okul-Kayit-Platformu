import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrencinin öğretmenleri — velinin mesajlaşma için öğretmen seçebilmesi için.
 * Öğrencinin sınıfının (classroomId) ders programındaki (TimetableSlot) farklı
 * öğretmenleri döner. Yetki: STUDENT (kendi) / PARENT (velisi) / personel.
 */
const STAFF: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.PARENT) {
      const parent = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const g = parent ? await tx.studentGuardian.findUnique({ where: { studentId_parentId: { studentId: student.id, parentId: parent.id } } }) : null;
      if (!g) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.STUDENT) {
      const own = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (own?.id !== student.id) return { kind: "forbidden" as const };
    } else if (!STAFF.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    if (!student.classroomId) return { kind: "ok" as const, teachers: [] };
    const slots = await tx.timetableSlot.findMany({
      where: { classroomId: student.classroomId },
      include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    const seen = new Set<string>();
    const teachers: { userId: string; name: string }[] = [];
    for (const s of slots) {
      const u = s.teacher.user;
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      teachers.push({ userId: u.id, name: `${u.firstName} ${u.lastName}` });
    }
    return { kind: "ok" as const, teachers };
  });

  if (result.kind === "not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  if (result.kind === "forbidden") return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });
  return NextResponse.json({ teachers: result.teachers });
}
