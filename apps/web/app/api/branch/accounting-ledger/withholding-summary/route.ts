import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { withholdingBreakdown } from "@/lib/tax";

/**
 * Kira Stopajı Özeti — GVK md 94 kapsamında stopaja tabi işaretlenmiş (bkz.
 * AccountingLedgerEntry.withholdingRate), kategorisi "kira" içeren GIDER
 * kayıtlarının toplamı (bkz. task #84, demo kiraStopajSummary). KDV
 * Özeti'yle aynı desen — accounting-ledger/vat-summary'nin withholding
 * karşılığı, yalnızca Kira'ya daraltılmış.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol kira stopajı özetini görüntüleyemez" }, { status: 403 });
  }

  const entries = await withBranchTenantContext(actor, (tx) =>
    tx.accountingLedgerEntry.findMany({
      where: { type: "GIDER", category: { contains: "kira", mode: "insensitive" }, withholdingRate: { not: null } },
      orderBy: { entryDate: "desc" },
    }),
  );

  let brutToplam = 0;
  let stopajKesintisi = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    const { withholdingAmount } = withholdingBreakdown(amount, Number(entry.withholdingRate));
    brutToplam += amount;
    stopajKesintisi += withholdingAmount;
  }
  brutToplam = round2(brutToplam);
  stopajKesintisi = round2(stopajKesintisi);

  return NextResponse.json({
    summary: {
      kayitSayisi: entries.length,
      brutToplam,
      stopajKesintisi,
      netOdenecek: round2(brutToplam - stopajKesintisi),
    },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
