import { NextRequest, NextResponse } from "next/server";
import { JournalSource, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { JournalUnbalancedError, postJournal, seedChartForTenant } from "@/lib/accounting/posting";

/**
 * Kasa / Banka. GET: 100 Kasa, 102 Bankalar, 108 POS hesaplarının bakiyeleri
 * (JournalLine'lardan). POST: iki hesap arası transfer (ör. Kasa→Banka) —
 * dengeli KASA_BANKA yevmiye fişi yazar. RLS: tenant + rol.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
const CASH_CODES = ["100", "102", "108"];

function guard(actor: { role: UserRole; actingTenantId?: string | null } | null) {
  if (!actor) return { ok: false as const, status: 401, message: "Oturum açmanız gerekiyor" };
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return { ok: false as const, status: 403, message: "Bu rol Muhasebe'ye erişemez" };
  }
  return { ok: true as const };
}
function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const accounts = await withBranchTenantContext(actor!, async (tx) => {
    let accs = await tx.accountingAccount.findMany({ where: { code: { in: CASH_CODES } } });
    if (accs.length === 0) {
      await seedChartForTenant(tx, effectiveTenantId(actor!));
      accs = await tx.accountingAccount.findMany({ where: { code: { in: CASH_CODES } } });
    }
    const ids = accs.map((a) => a.id);
    const lines = await tx.journalLine.findMany({ where: { accountId: { in: ids } }, select: { accountId: true, debit: true, credit: true } });
    const bal = new Map<string, number>();
    for (const l of lines) bal.set(l.accountId, (bal.get(l.accountId) ?? 0) + Number(l.debit) - Number(l.credit));
    return accs
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((a) => ({ code: a.code, name: a.name, balance: round2(bal.get(a.id) ?? 0) }));
  });

  return NextResponse.json({ accounts, total: round2(accounts.reduce((s, a) => s + a.balance, 0)) });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const fromCode = typeof body.fromCode === "string" && CASH_CODES.includes(body.fromCode) ? body.fromCode : null;
  const toCode = typeof body.toCode === "string" && CASH_CODES.includes(body.toCode) ? body.toCode : null;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : null;
  if (!fromCode || !toCode || fromCode === toCode || !amount) {
    return NextResponse.json({ message: "Geçerli fromCode, toCode (farklı) ve amount (>0) gerekir" }, { status: 400 });
  }

  try {
    await withBranchTenantContext(actor!, (tx) =>
      postJournal(tx, {
        tenantId: effectiveTenantId(actor!),
        entryDate: new Date(),
        description: `Virman — ${fromCode} → ${toCode}`,
        source: JournalSource.KASA_BANKA,
        createdByUserId: actor!.id,
        lines: [
          { code: toCode, debit: amount, description: "Virman giriş" },
          { code: fromCode, credit: amount, description: "Virman çıkış" },
        ],
      }),
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof JournalUnbalancedError) return NextResponse.json({ message: e.message }, { status: 400 });
    return NextResponse.json({ message: "Transfer kaydedilemedi" }, { status: 500 });
  }
}
