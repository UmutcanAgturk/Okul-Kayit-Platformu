import { NextRequest, NextResponse } from "next/server";
import { AccountingEntryType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Mali Özet" (Görüntüle/Yazdır) kartı — demo'daki `buildMaliOzetHtml()`'in
 * gerçek karşılığı: gerçek `AccountingLedgerEntry` verisinden kategori bazlı
 * gelir/gider dökümü ve net kâr. CSV'lerin aksine JSON döner (frontend bunu
 * yazdırılabilir bir görünümde render eder).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol bu raporu görüntüleyemez" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const entries = await tx.accountingLedgerEntry.findMany();

    const byCategory = new Map<string, { type: AccountingEntryType; category: string; amount: number }>();
    for (const e of entries) {
      const key = `${e.type}|${e.category}`;
      const amount = Number(e.amount);
      const existing = byCategory.get(key);
      if (existing) existing.amount += amount;
      else byCategory.set(key, { type: e.type, category: e.category, amount });
    }
    const rows = Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount);

    const gelir = entries.filter((e) => e.type === AccountingEntryType.GELIR).reduce((sum, e) => sum + Number(e.amount), 0);
    const gider = entries.filter((e) => e.type === AccountingEntryType.GIDER).reduce((sum, e) => sum + Number(e.amount), 0);

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Rapor görüntülendi",
      detail: "Mali Özet",
    });

    return {
      rows,
      totalIncome: gelir,
      totalExpense: gider,
      netProfit: gelir - gider,
      recordCount: entries.length,
    };
  });

  return NextResponse.json(result);
}
