import { NextRequest, NextResponse } from "next/server";
import { JournalSource, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { computePayroll } from "@/lib/payroll";
import { tryPostJournal } from "@/lib/accounting/posting";
import { ACC } from "@/lib/accounting/chart";

/**
 * Basitleştirilmiş bordro modülü — brüt maaştan SGK/işsizlik/gelir vergisi/
 * damga vergisi kesintilerini hesaplar (bkz. lib/payroll.ts — resmi bir
 * bordro motoru DEĞİLDİR, bilinçli basitleştirmeler için oradaki yorumlara
 * bakın). Her bordro, işverene toplam maliyeti (brüt + işveren payları) tek
 * bir "Personel Maaşı" gider kalemi olarak Muhasebe defterine de yazar —
 * PaymentInstallment.collect'in ledger'a satır düşme deseniyle aynı.
 *
 * SUPERADMIN, Kurumlar sayfasından "Bu Şube Olarak Yönet" ile bir şube
 * seçtiğinde (bkz. lib/db-context.ts withBranchTenantContext) buraya da
 * erişebilir; RLS o seçilen tek şubeyle sınırlar.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol bordroları görüntüleyemez" }, { status: 403 });
  }

  const records = await withBranchTenantContext(actor, (tx) =>
    tx.payrollRecord.findMany({
      include: {
        teacher: { include: { user: true } },
        staffProfile: { include: { user: true } },
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    }),
  );

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      period: r.period,
      teacherId: r.teacherId,
      staffProfileId: r.staffProfileId,
      personName: r.teacher
        ? `${r.teacher.user.firstName} ${r.teacher.user.lastName}`
        : `${r.staffProfile!.user.firstName} ${r.staffProfile!.user.lastName}`,
      personRole: r.teacher ? "TEACHER" : "STAFF",
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
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol bordro oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teacherId = typeof body.teacherId === "string" && body.teacherId ? body.teacherId : null;
  const staffProfileId = typeof body.staffProfileId === "string" && body.staffProfileId ? body.staffProfileId : null;
  const period = typeof body.period === "string" && /^\d{4}-\d{2}$/.test(body.period) ? body.period : null;
  const grossSalary = typeof body.grossSalary === "number" && body.grossSalary > 0 ? body.grossSalary : null;

  if ((!teacherId && !staffProfileId) || (teacherId && staffProfileId) || !period || !grossSalary) {
    return NextResponse.json(
      { message: "teacherId veya staffProfileId (yalnızca biri), period (YYYY-MM) ve grossSalary (>0) zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    let personName: string;

    if (teacherId) {
      // TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (bkz.
      // prisma/rls/README.md) — bu yüzden "bu öğretmen gerçekten bu şubede mi"
      // kontrolü burada, uygulama katmanında elle yapılır.
      const teacher = await tx.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
      if (!teacher || teacher.user.tenantId !== effectiveTenantId(actor)) {
        return { kind: "not_found" as const };
      }
      personName = `${teacher.user.firstName} ${teacher.user.lastName}`;

      const existing = await tx.payrollRecord.findUnique({ where: { teacherId_period: { teacherId, period } } });
      if (existing) {
        return { kind: "duplicate" as const };
      }
    } else {
      // StaffProfile RLS ile tenant'a scope edilmiştir (tenant_and_role_isolation) —
      // başka bir tenant'a ait bir id burada zaten görünmez (null döner).
      const staff = await tx.staffProfile.findUnique({ where: { id: staffProfileId! }, include: { user: true } });
      if (!staff) {
        return { kind: "not_found" as const };
      }
      personName = `${staff.user.firstName} ${staff.user.lastName}`;

      const existing = await tx.payrollRecord.findUnique({
        where: { staffProfileId_period: { staffProfileId: staffProfileId!, period } },
      });
      if (existing) {
        return { kind: "duplicate" as const };
      }
    }

    const breakdown = computePayroll(grossSalary);

    const ledgerEntry = await tx.accountingLedgerEntry.create({
      data: {
        tenantId: effectiveTenantId(actor),
        type: "GIDER",
        category: "Personel Maaşı",
        amount: breakdown.employerCost,
        entryDate: new Date(),
        note: `${personName} — ${period} bordrosu (işveren toplam maliyeti)`,
        createdByUserId: actor.id,
      },
    });

    const record = await tx.payrollRecord.create({
      data: {
        tenantId: effectiveTenantId(actor),
        teacherId: teacherId ?? undefined,
        staffProfileId: staffProfileId ?? undefined,
        period,
        grossSalary,
        ...breakdown,
        ledgerEntryId: ledgerEntry.id,
        createdByUserId: actor.id,
      },
    });

    // Çift taraflı yevmiye (en iyi çaba): Borç 770.01 Personel Gideri (brüt +
    // işveren payları) / Alacak 335 Personele Borçlar (net) / Alacak 360
    // Ödenecek Vergi (gelir vergisi + damga) / Alacak 361 Ödenecek SGK
    // (çalışan + işveren payları).
    const employerShares = breakdown.sgkEmployerShare + breakdown.unemploymentEmployerShare;
    await tryPostJournal(tx, {
      tenantId: effectiveTenantId(actor),
      entryDate: new Date(),
      description: `Bordro — ${personName} (${period})`,
      source: JournalSource.BORDRO,
      sourceRefId: record.id,
      createdByUserId: actor.id,
      lines: [
        { code: ACC.GYG_PERSONEL, debit: grossSalary + employerShares, description: "Personel gideri" },
        { code: ACC.PERSONELE_BORC, credit: breakdown.netSalary, description: "Net maaş" },
        { code: ACC.OD_VERGI, credit: breakdown.incomeTaxWithheld + breakdown.stampDutyWithheld, description: "Gelir vergisi + damga" },
        { code: ACC.OD_SGK, credit: breakdown.sgkEmployeeShare + breakdown.unemploymentEmployeeShare + employerShares, description: "SGK (çalışan+işveren)" },
      ],
    });

    return { kind: "created" as const, record };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: teacherId ? "Öğretmen bulunamadı" : "Personel bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "duplicate") {
    return NextResponse.json({ message: `Bu kişi için ${period} bordrosu zaten oluşturulmuş` }, { status: 409 });
  }
  return NextResponse.json({ record: outcome.record }, { status: 201 });
}
