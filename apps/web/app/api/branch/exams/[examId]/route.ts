import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınav detayını görüntüleyemez" }, { status: 403 });
  }

  const exam = await withBranchTenantContext(actor, (tx) =>
    tx.exam.findUnique({
      where: { id: params.examId },
      include: { questions: { orderBy: { orderIndex: "asc" }, include: { achievement: true } } },
    }),
  );

  if (!exam) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      examDate: exam.examDate.toISOString().slice(0, 10),
      bookletTypes: exam.bookletTypes,
      feePerStudent: exam.feePerStudent ? Number(exam.feePerStudent) : null,
      eligibleGradeLevels: exam.eligibleGradeLevels,
      questions: exam.questions.map((q) => ({
        id: q.id,
        orderIndex: q.orderIndex,
        achievementId: q.achievementId,
        achievementCode: q.achievement.code,
        achievementLabel: q.achievement.label,
        subject: subjectFromCode(q.achievement.code),
        correctAnswer: q.correctAnswer,
      })),
    },
  });
}
