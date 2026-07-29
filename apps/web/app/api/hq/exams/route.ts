import { NextRequest, NextResponse } from "next/server";
import { ExamScope, ExamType, GradeLevel, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { EXAM_ELIGIBLE_GRADE_LEVELS, opticFormsPerStudent } from "@/lib/grade-tier";

/**
 * "Genel Sınav Merkezi" — demo/seviye360-app.html'deki SCREENS["hq:exam"]'ın
 * gerçek karşılığı. SUPERADMIN, Türkiye geneli (NETWORK kapsamlı) bir deneme
 * sınavı tanımlar; optik form ihtiyacı ve toplam fatura tutarı, seçilen sınıf
 * düzeylerindeki (Ortaokul+Lise) TÜM şubelerdeki GERÇEK StudentProfile
 * sayısından her görüntülemede yeniden hesaplanır (donmuş bir anlık görüntü
 * değil).
 *
 * Demo'nun aksine hangi şubelerin "davet edildiği" ayrı bir alan olarak
 * SAKLANMAZ — bkz. prisma/schema.prisma Exam modelindeki not: NETWORK bir
 * sınav, tanımı gereği hedeflenen sınıf düzeyindeki TÜM şubelere gönderilir.
 * Bu, demo'daki opsiyonel şube alt kümesi seçimini kasıtlı olarak
 * basitleştirir (branch bazlı dağıtım/lojistik takibi ayrı, daha büyük bir
 * özellik olurdu).
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
    const exams = await tx.exam.findMany({ where: { scope: ExamScope.NETWORK }, orderBy: { examDate: "desc" } });

    return Promise.all(
      exams.map(async (exam) => {
        const studentCount = await tx.studentProfile.count({
          where: { gradeLevel: { in: exam.eligibleGradeLevels }, tenant: { type: TenantType.SUBE } },
        });
        const students = await tx.studentProfile.findMany({
          where: { gradeLevel: { in: exam.eligibleGradeLevels }, tenant: { type: TenantType.SUBE } },
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

  if (!name || !examDate || eligibleGradeLevels.length === 0) {
    return NextResponse.json(
      { message: "name, examDate ve en az bir eligibleGradeLevels (Ortaokul/Lise) zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const genelMerkez = await tx.tenant.findFirst({ where: { type: TenantType.GENEL_MERKEZ } });
    if (!genelMerkez) throw new Error("Genel Merkez tenant'ı bulunamadı");

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
      },
    });

    const studentCount = await tx.studentProfile.count({
      where: { gradeLevel: { in: eligibleGradeLevels }, tenant: { type: TenantType.SUBE } },
    });
    const students = await tx.studentProfile.findMany({
      where: { gradeLevel: { in: eligibleGradeLevels }, tenant: { type: TenantType.SUBE } },
      select: { gradeLevel: true },
    });
    const opticFormCount = students.reduce((sum, s) => sum + opticFormsPerStudent(s.gradeLevel), 0);
    const totalFee = feePerStudent ? studentCount * feePerStudent : 0;

    await logActivity(tx, {
      tenantId: genelMerkez.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Genel Sınav tanımlandı",
      detail: `${exam.name} — ${studentCount} öğrenci, ${opticFormCount} optik form`,
    });

    return { exam, studentCount, opticFormCount, totalFee };
  });

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
      studentCount: outcome.studentCount,
      opticFormCount: outcome.opticFormCount,
      totalFee: outcome.totalFee,
    },
    { status: 201 },
  );
}
