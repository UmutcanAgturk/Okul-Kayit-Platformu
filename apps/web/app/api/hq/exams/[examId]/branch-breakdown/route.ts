import { NextRequest, NextResponse } from "next/server";
import { ExamScope, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Genel Sınav Merkezi — şube bazlı fatura kırılımı. demo/seviye360-app.html'deki
 * examBranchBreakdown()'ın karşılığı — Logo/Tiger CSV dışa aktarımının
 * (bkz. lib/api/logo-tiger-csv.ts) veri kaynağıdır: her şube için gerçek
 * StudentProfile sayısı × sınavın kişi başı ücreti.
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
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam || exam.scope !== ExamScope.NETWORK) return null;

    const branches = await tx.tenant.findMany({ where: { type: TenantType.SUBE }, orderBy: { name: "asc" } });
    const rows = await Promise.all(
      branches.map(async (b) => {
        const studentCount = await tx.studentProfile.count({
          where: { tenantId: b.id, gradeLevel: { in: exam.eligibleGradeLevels } },
        });
        const totalFee = exam.feePerStudent ? studentCount * Number(exam.feePerStudent) : 0;
        return { tenantId: b.id, tenantCode: b.code, tenantName: b.name, studentCount, totalFee };
      }),
    );

    return {
      exam: { id: exam.id, name: exam.name, examDate: exam.examDate.toISOString().slice(0, 10), feePerStudent: exam.feePerStudent },
      branches: rows.filter((r) => r.studentCount > 0),
    };
  });

  if (!result) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(result);
}
