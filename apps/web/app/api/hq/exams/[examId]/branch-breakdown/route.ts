import { NextRequest, NextResponse } from "next/server";
import { ExamScope, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { opticFormsPerStudent } from "@/lib/grade-tier";

/**
 * Genel Sınav Merkezi — şube bazlı fatura/optik/sevkiyat kırılımı.
 * demo/seviye360-app.html'deki examBranchBreakdown()'ın karşılığı —
 * hem Logo/Tiger CSV dışa aktarımının (bkz. lib/api/logo-tiger-csv.ts) HEM
 * DE HqExamsPanel'deki inline "dağılım tablosu"nun veri kaynağıdır. Yalnızca
 * sınavın ExamBranchDispatch ile hedeflediği şubeleri döner (artık TÜM
 * şubeler değil — bkz. task #53).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.SUPERADMIN];

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez bu dökümü görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id: params.examId },
      include: { branchDispatches: { include: { tenant: true }, orderBy: { tenant: { name: "asc" } } } },
    });
    if (!exam || exam.scope !== ExamScope.NETWORK) return null;

    const rows = await Promise.all(
      exam.branchDispatches.map(async (d) => {
        const students = await tx.studentProfile.findMany({
          where: { tenantId: d.tenantId, gradeLevel: { in: exam.eligibleGradeLevels } },
          select: { gradeLevel: true },
        });
        const studentCount = students.length;
        const opticFormCount = students.reduce((sum, s) => sum + opticFormsPerStudent(s.gradeLevel), 0);
        const totalFee = exam.feePerStudent ? studentCount * Number(exam.feePerStudent) : 0;
        return {
          tenantId: d.tenantId,
          tenantCode: d.tenant.code,
          tenantName: d.tenant.name,
          studentCount,
          opticFormCount,
          totalFee,
          dispatchStatus: d.status,
        };
      }),
    );

    return {
      exam: { id: exam.id, name: exam.name, examDate: exam.examDate.toISOString().slice(0, 10), feePerStudent: exam.feePerStudent },
      branches: rows,
    };
  });

  if (!result) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(result);
}
