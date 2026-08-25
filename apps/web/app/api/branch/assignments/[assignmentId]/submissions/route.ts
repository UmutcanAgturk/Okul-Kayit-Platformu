import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Öğretmen/yönetim — bir ödevin teslimleri + tam sınıf listesi (teslim
 * etmeyenler dahil). RLS: Assignment tenant_isolation + AssignmentSubmission
 * üst-kayıt politikası.
 */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest, { params }: { params: { assignmentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol teslimleri görüntüleyemez" }, { status: 403 });

  const data = await withBranchTenantContext(actor, async (tx) => {
    const assignment = await tx.assignment.findUnique({ where: { id: params.assignmentId } });
    if (!assignment) return null;

    const students = await tx.studentProfile.findMany({
      where: assignment.classroomId ? { classroomId: assignment.classroomId } : { user: { isActive: true } },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    });
    const submissions = await tx.assignmentSubmission.findMany({ where: { assignmentId: assignment.id } });
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

    const rows = students.map((st) => {
      const sub = byStudent.get(st.id);
      return {
        studentId: st.id,
        studentName: `${st.user.firstName} ${st.user.lastName}`,
        submissionId: sub?.id ?? null,
        status: sub?.status ?? "ASSIGNED",
        submittedAt: sub?.submittedAt ? sub.submittedAt.toISOString() : null,
        note: sub?.note ?? null,
        fileName: sub?.fileName ?? null,
        hasFile: !!sub?.dataUrl,
        grade: sub?.grade ?? null,
        feedback: sub?.feedback ?? null,
        gradedAt: sub?.gradedAt ? sub.gradedAt.toISOString() : null,
      };
    });

    return {
      assignment: { id: assignment.id, title: assignment.title, description: assignment.description, dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null },
      submittedCount: rows.filter((r) => r.status !== "ASSIGNED").length,
      gradedCount: rows.filter((r) => r.status === "GRADED").length,
      total: rows.length,
      rows,
    };
  });

  if (!data) return NextResponse.json({ message: "Ödev bulunamadı" }, { status: 404 });
  return NextResponse.json(data);
}
