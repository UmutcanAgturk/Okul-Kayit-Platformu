import { NextRequest, NextResponse } from "next/server";
import { AccountType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { seedChartForTenant } from "@/lib/accounting/posting";

/**
 * Bütçe (bütçe vs gerçekleşen). GET ?year= : gelir/gider hesapları için
 * planlanan (BudgetLine) ve gerçekleşen (yevmiyeden, ilgili yıl) tutarları
 * yan yana. POST: bir hesabın yıllık bütçesini upsert eder. RLS: tenant + rol.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

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

  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const data = await withBranchTenantContext(actor!, async (tx) => {
    let accounts = await tx.accountingAccount.findMany({
      where: { type: { in: [AccountType.GELIR, AccountType.GIDER, AccountType.MALIYET] } },
      orderBy: { code: "asc" },
    });
    if (accounts.length === 0) {
      await seedChartForTenant(tx, effectiveTenantId(actor!));
      accounts = await tx.accountingAccount.findMany({
        where: { type: { in: [AccountType.GELIR, AccountType.GIDER, AccountType.MALIYET] } },
        orderBy: { code: "asc" },
      });
    }

    const lines = await tx.journalLine.findMany({
      where: { accountId: { in: accounts.map((a) => a.id) }, journalEntry: { entryDate: { gte: start, lte: end } } },
      select: { accountId: true, debit: true, credit: true },
    });
    const actualByAcc = new Map<string, number>();
    for (const l of lines) actualByAcc.set(l.accountId, (actualByAcc.get(l.accountId) ?? 0) + Number(l.debit) - Number(l.credit));

    const budgets = await tx.budgetLine.findMany({ where: { year } });
    const plannedByCode = new Map(budgets.map((b) => [b.accountCode, Number(b.plannedAmount)]));

    const rows = accounts.map((a) => {
      const raw = actualByAcc.get(a.id) ?? 0;
      // Gelir hesaplarında gerçekleşen = alacak-borç; gider/maliyette borç-alacak.
      const actual = a.type === AccountType.GELIR ? round2(-raw) : round2(raw);
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        planned: round2(plannedByCode.get(a.code) ?? 0),
        actual,
      };
    }).filter((r) => r.planned !== 0 || r.actual !== 0);

    return { year, rows };
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const year = Number(body.year);
  const accountCode = typeof body.accountCode === "string" && body.accountCode.trim() ? body.accountCode.trim() : null;
  const plannedAmount = typeof body.plannedAmount === "number" && body.plannedAmount >= 0 ? body.plannedAmount : null;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !accountCode || plannedAmount === null) {
    return NextResponse.json({ message: "year, accountCode ve plannedAmount (>=0) zorunludur" }, { status: 400 });
  }

  try {
    await withBranchTenantContext(actor!, async (tx) => {
      const tenantId = effectiveTenantId(actor!);
      const acc = await tx.accountingAccount.findFirst({ where: { code: accountCode }, select: { id: true } });
      if (!acc) throw new Error("account_not_found");
      const existing = await tx.budgetLine.findFirst({ where: { year, accountCode } });
      if (existing) {
        await tx.budgetLine.update({ where: { id: existing.id }, data: { plannedAmount } });
      } else {
        await tx.budgetLine.create({ data: { tenantId, year, accountCode, plannedAmount } });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "account_not_found") {
      return NextResponse.json({ message: "Hesap bulunamadı" }, { status: 400 });
    }
    return NextResponse.json({ message: "Bütçe kaydedilemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
