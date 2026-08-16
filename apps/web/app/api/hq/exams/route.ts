import { NextRequest, NextResponse } from "next/server";
import { ExamScope, ExamType, GradeLevel, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { EXAM_ELIGIBLE_GRADE_LEVELS, opticFormsPerStudent } from "@/lib/grade-tier";

/**
 * "Genel Sınav Merkezi" — demo/seviye360-app.html'deki SCREENS["hq:exam"]'ın
 * gerçek karşılığı. SUPERADMIN, Türkiye geneli (NETWORK kapsamlı) bir deneme
 * sınavı tanımlar; optik form ihtiyacı ve toplam fatura tutarı, hedeflenen
 * şubelerdeki (bkz. ExamBranchDispatch) GERÇEK StudentProfile sayısından her
 * görüntülemede yeniden hesaplanır (donmuş bir anlık görüntü değil).
 *
 * Demo'daki gibi hangi şubelerin "davet edildiği" branchIds ile seçilebilir
 * (opsiyonel — verilmezse demo'nun varsayılan "Tümü" işaretli davranışıyla
 * aynı şekilde, seçilen sınıf düzeylerindeki TÜM aktif şubeler hedeflenir).
 * Bu seçim, sınav oluşturulduğunda bir ExamBranchDispatch satırı (kitapçık
 * sevkiyat durumu HAZIRLANIYOR ile) olarak kalıcılaşır.
 *
 * Exam.tenantId NETWORK sınavlarda sınavı yayınlayan Genel Merkez tenant'ına
 * işaret eder — SUPERADMIN'in kendisi hiçbir tenant'a bağlı olmadığından
 * (User.tenantId=null, bkz. seed.ts notu) bu, actor.tenantId DEĞİL, ayrıca
 * sorgulanan GENEL_MERKEZ tenant satırıdır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.SUPERADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez Genel Sınav Merkezi'ni görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const exams = await tx.exam.findMany({
      where: { scope: ExamScope.NETWORK },
      include: { branchDispatches: true },
      orderBy: { examDate: "desc" },
    });

    return Promise.all(
      exams.map(async (exam) => {
        const branchIds = exam.branchDispatches.map((d) => d.tenantId);
        const studentCount = await tx.studentProfile.count({
          where: { gradeLevel: { in: exam.eligibleGradeLevels }, tenantId: { in: branchIds } },
        });
        const students = await tx.studentProfile.findMany({
          where: { gradeLevel: { in: exam.eligibleGradeLevels }, tenantId: { in: branchIds } },
          select: { gradeLevel: true },
        });
        const opticFormCount = students.reduce((sum, s) => sum + opticFormsPerStudent(s.gradeLevel), 0);
        const totalFee = exam.feePerStudent ? studentCount * Number(exam.feePerStudent) : 0;

        return {
          id: exam.id,
          name: exam.name,
          examDate: exam.examDate.toISOString().slice(0, 10),
          bookletTypes: exam.bookletTypes,
          eligibleGradeLevels: exam.eligibleGradeLevels,
          feePerStudent: exam.feePerStudent,
          branchCount: branchIds.length,
          studentCount,
          opticFormCount,
          totalFee,
        };
      }),
    );
  });

  return NextResponse.json({ exams: result });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez yeni bir Genel Sınav tanımlayabilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const examDate = typeof body.examDate === "string" && !isNaN(Date.parse(body.examDate)) ? new Date(body.examDate) : null;
  const bookletCount = body.bookletCount === 2 ? 2 : 4;
  const feePerStudent = typeof body.feePerStudent === "number" && body.feePerStudent >= 0 ? body.feePerStudent : null;
  const eligibleGradeLevels: GradeLevel[] = Array.isArray(body.eligibleGradeLevels)
    ? body.eligibleGradeLevels.filter((g: unknown): g is GradeLevel => typeof g === "string" && EXAM_ELIGIBLE_GRADE_LEVELS.includes(g as GradeLevel))
    : [];
  const requestedBranchIds: string[] | null = Array.isArray(body.branchIds)
    ? body.branchIds.filter((id: unknown): id is string => typeof id === "string")
    : null;

  if (!name || !examDate || eligibleGradeLevels.length === 0) {
    return NextResponse.json(
      { message: "name, examDate ve en az bir eligibleGradeLevels (Ortaokul/Lise) zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const genelMerkez = await tx.tenant.findFirst({ where: { type: TenantType.GENEL_MERKEZ } });
    if (!genelMerkez) throw new Error("Genel Merkez tenant'ı bulunamadı");

    const activeBranches = await tx.tenant.findMany({ where: { type: TenantType.SUBE, isActive: true }, select: { id: true } });
    const activeBranchIds = new Set(activeBranches.map((b) => b.id));
    const branchIds = requestedBranchIds ? requestedBranchIds.filter((id) => activeBranchIds.has(id)) : Array.from(activeBranchIds);
    if (branchIds.length === 0) {
      return { error: "no_branches" as const };
    }

    const exam = await tx.exam.create({
      data: {
        tenantId: genelMerkez.id,
        name,
        type: ExamType.DENEME,
        scope: ExamScope.NETWORK,
        bookletTypes: bookletCount === 2 ? ["A", "B"] : ["A", "B", "C", "D"],
        examDate,
        feePerStudent,
        eligibleGradeLevels,
        branchDispatches: { createMany: { data: branchIds.map((tenantId) => ({ tenantId })) } },
      },
    });

    const studentCount = await tx.studentProfile.count({
      where: { gradeLevel: { in: eligibleGradeLevels }, tenantId: { in: branchIds } },
    });
    const students = await tx.studentProfile.findMany({
      where: { gradeLevel: { in: eligibleGradeLevels }, tenantId: { in: branchIds } },
      select: { gradeLevel: true },
    });
    const opticFormCount = students.reduce((sum, s) => sum + opticFormsPerStudent(s.gradeLevel), 0);
    const totalFee = feePerStudent ? studentCount * feePerStudent : 0;

    await logActivity(tx, {
      tenantId: genelMerkez.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Genel Sınav tanımlandı",
      detail: `${exam.name} — ${branchIds.length} şube, ${studentCount} öğrenci, ${opticFormCount} optik form`,
    });

    return { exam, branchCount: branchIds.length, studentCount, opticFormCount, totalFee };
  });

  if ("error" in outcome) {
    return NextResponse.json({ message: "Seçilen şubelerin hiçbiri aktif değil" }, { status: 400 });
  }

  return NextResponse.json(
    {
      exam: {
        id: outcome.exam.id,
        name: outcome.exam.name,
        examDate: outcome.exam.examDate.toISOString().slice(0, 10),
        bookletTypes: outcome.exam.bookletTypes,
        eligibleGradeLevels: outcome.exam.eligibleGradeLevels,
        feePerStudent: outcome.exam.feePerStudent,
      },
      branchCount: outcome.branchCount,
      studentCount: outcome.studentCount,
      opticFormCount: outcome.opticFormCount,
      totalFee: outcome.totalFee,
    },
    { status: 201 },
  );
}
