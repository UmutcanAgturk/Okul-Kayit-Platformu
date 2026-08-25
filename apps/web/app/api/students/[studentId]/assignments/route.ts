import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrenci/veli — öğrencinin ödevleri + kendi teslim durumu. Öğrenci kendi
 * sınıfının (classroomId) ve şube geneli (classroomId null) ödevlerini görür.
 * Yetki: STUDENT (kendi) / PARENT (velisi olduğu) / personel.
 */
const STAFF: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const own = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (own?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parent = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const g = parent ? await tx.studentGuardian.findUnique({ where: { studentId_parentId: { studentId: student.id, parentId: parent.id } } }) : null;
      if (!g) return { kind: "forbidden" as const };
    } else if (!STAFF.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const assignments = await tx.assignment.findMany({
      where: { OR: [{ classroomId: student.classroomId ?? "___none___" }, { classroomId: null }] },
      orderBy: { createdAt: "desc" },
    });
    const submissions = await tx.assignmentSubmission.findMany({ where: { studentId: student.id, assignmentId: { in: assignments.map((a) => a.id) } } });
    const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

    return {
      kind: "ok" as const,
      assignments: assignments.map((a) => {
        const sub = byAssignment.get(a.id);
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          attachments: a.attachments,
          status: sub?.status ?? "ASSIGNED",
          submittedAt: sub?.submittedAt ? sub.submittedAt.toISOString() : null,
          note: sub?.note ?? null,
          fileName: sub?.fileName ?? null,
          grade: sub?.grade ?? null,
          feedback: sub?.feedback ?? null,
        };
      }),
    };
  });

  if (result.kind === "not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  if (result.kind === "forbidden") return NextResponse.json({ message: "Bu öğrencinin ödevlerini görüntüleyemezsiniz" }, { status: 403 });
  return NextResponse.json({ assignments: result.assignments });
}
