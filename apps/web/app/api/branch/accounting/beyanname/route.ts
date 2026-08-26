import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Beyanname hazırlama — seçilen ay için KDV Beyannamesi (KDV1), Muhtasar ve
 * Prim Hizmet (SGK) özet tutarları. Muhasebe defteri (KDV/stopaj) ve bordro
 * kayıtlarından türetilir; resmi beyan yerine geçmez, hazırlık/özet amaçlıdır.
 * RLS: tenant + rol.
 */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol beyanname görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || now.getMonth() + 1; // 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const period = `${year}-${String(month).padStart(2, "0")}`;

  const data = await withBranchTenantContext(actor, async (tx) => {
    const ledger = await tx.accountingLedgerEntry.findMany({
      where: { entryDate: { gte: start, lte: end } },
      select: { type: true, category: true, amount: true, vatRate: true, withholdingRate: true },
    });

    // KDV1
    let hesaplananKDV = 0, indirilecekKDV = 0;
    for (const e of ledger) {
      if (e.vatRate == null) continue;
      const rate = Number(e.vatRate);
      const amount = Number(e.amount);
      const kdv = amount - amount / (1 + rate);
      if (e.type === "GELIR") hesaplananKDV += kdv;
      else indirilecekKDV += kdv;
    }
    hesaplananKDV = round2(hesaplananKDV);
    indirilecekKDV = round2(indirilecekKDV);
    const odenecekKDV = round2(Math.max(0, hesaplananKDV - indirilecekKDV));
    const devredenKDV = round2(Math.max(0, indirilecekKDV - hesaplananKDV));

    // Kira stopajı (Muhtasar — GVK 94)
    let kiraStopaji = 0;
    for (const e of ledger) {
      if (e.withholdingRate == null) continue;
      const rate = Number(e.withholdingRate);
      const amount = Number(e.amount);
      const matrah = amount / (1 + rate); // brütten net kira matrahı yaklaşımı
      kiraStopaji += matrah * rate;
    }
    kiraStopaji = round2(kiraStopaji);

    // Bordro — ücret stopajı + damga + SGK
    const payrolls = await tx.payrollRecord.findMany({
      where: { period },
      select: { incomeTaxWithheld: true, stampDutyWithheld: true, sgkEmployeeShare: true, unemploymentEmployeeShare: true, sgkEmployerShare: true, unemploymentEmployerShare: true },
    });
    let ucretStopaji = 0, damga = 0, sgkPrim = 0;
    for (const p of payrolls) {
      ucretStopaji += Number(p.incomeTaxWithheld);
      damga += Number(p.stampDutyWithheld);
      sgkPrim += Number(p.sgkEmployeeShare) + Number(p.unemploymentEmployeeShare) + Number(p.sgkEmployerShare) + Number(p.unemploymentEmployerShare);
    }
    ucretStopaji = round2(ucretStopaji);
    damga = round2(damga);
    sgkPrim = round2(sgkPrim);

    return {
      period,
      kdv: { hesaplananKDV, indirilecekKDV, odenecekKDV, devredenKDV },
      muhtasar: { ucretStopaji, kiraStopaji, damga, toplam: round2(ucretStopaji + kiraStopaji + damga) },
      sgk: { toplamPrim: sgkPrim, personelSayisi: payrolls.length },
    };
  });

  return NextResponse.json(data);
}
