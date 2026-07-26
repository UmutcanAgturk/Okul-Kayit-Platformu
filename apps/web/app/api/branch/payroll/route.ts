import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { computePayroll } from "@/lib/payroll";

/**
 * Basitleştirilmiş bordro modülü — brüt maaştan SGK/işsizlik/gelir vergisi/
 * damga vergisi kesintilerini hesaplar (bkz. lib/payroll.ts — resmi bir
 * bordro motoru DEĞİLDİR, bilinçli basitleştirmeler için oradaki yorumlara
 * bakın). Her bordro, işverene toplam maliyeti (brüt + işveren payları) tek
 * bir "Personel Maaşı" gider kalemi olarak Muhasebe defterine de yazar —
 * PaymentInstallment.collect'in ledger'a satır düşme deseniyle aynı.
 *
 * SUPERADMIN kasıtlı olarak dışarıda: diğer `/api/branch/...` route'larıyla
 * aynı gerekçe (tek bir şubeyi hedefler, Genel Merkez konsolide görünümü
 * kapsam dışı).
 */
const ROLES_ALLOWED = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol bordroları görüntüleyemez" }, { status: 403 });
  }

  const records = await withTenantContext(actor, (tx) =>
    tx.payrollRecord.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    }),
  );

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      period: r.period,
      teacherId: r.teacherId,
      teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
      grossSalary: r.grossSalary,
      sgkEmployeeShare: r.sgkEmployeeShare,
      unemploymentEmployeeShare: r.unemploymentEmployeeShare,
      incomeTaxWithheld: r.incomeTaxWithheld,
      stampDutyWithheld: r.stampDutyWithheld,
      netSalary: r.netSalary,
      sgkEmployerShare: r.sgkEmployerShare,
      unemploymentEmployerShare: r.unemploymentEmployerShare,
      employerCost: r.employerCost,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol bordro oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teacherId = typeof body.teacherId === "string" && body.teacherId ? body.teacherId : null;
  const period = typeof body.period === "string" && /^\d{4}-\d{2}$/.test(body.period) ? body.period : null;
  const grossSalary = typeof body.grossSalary === "number" && body.grossSalary > 0 ? body.grossSalary : null;

  if (!teacherId || !period || !grossSalary) {
    return NextResponse.json(
      { message: "teacherId, period (YYYY-MM) ve grossSalary (>0) zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    // TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (bkz.
    // prisma/rls/README.md) — bu yüzden "bu öğretmen gerçekten bu şubede mi"
    // kontrolü burada, uygulama katmanında elle yapılır.
    const teacher = await tx.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
    if (!teacher || teacher.user.tenantId !== actor.tenantId) {
      return { kind: "not_found" as const };
    }

    const existing = await tx.payrollRecord.findUnique({ where: { teacherId_period: { teacherId, period } } });
    if (existing) {
      return { kind: "duplicate" as const };
    }

    const breakdown = computePayroll(grossSalary);

    const ledgerEntry = await tx.accountingLedgerEntry.create({
      data: {
        tenantId: actor.tenantId!,
        type: "GIDER",
        category: "Personel Maaşı",
        amount: breakdown.employerCost,
        entryDate: new Date(),
        note: `${teacher.user.firstName} ${teacher.user.lastName} — ${period} bordrosu (işveren toplam maliyeti)`,
        createdByUserId: actor.id,
      },
    });

    const record = await tx.payrollRecord.create({
      data: {
        tenantId: actor.tenantId!,
        teacherId,
        period,
        grossSalary,
        ...breakdown,
        ledgerEntryId: ledgerEntry.id,
        createdByUserId: actor.id,
      },
    });

    return { kind: "created" as const, record };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "duplicate") {
    return NextResponse.json({ message: `Bu öğretmen için ${period} bordrosu zaten oluşturulmuş` }, { status: 409 });
  }
  return NextResponse.json({ record: outcome.record }, { status: 201 });
}
