import { NextRequest, NextResponse } from "next/server";
import { AccountType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Mali tablolar — Mizan, Gelir Tablosu, Bilanço, Defter-i Kebir. Hepsi
 * JournalLine üzerinden (tek gerçek kaynak) türetilir. RLS: tenant + rol.
 *   ?report=trial-balance | income-statement | balance-sheet | ledger
 *   ?accountId=  (ledger için zorunlu)
 *   ?from=&to=   (tarih aralığı, opsiyonel)
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe'ye erişemez" }, { status: 403 });
  }

  const report = request.nextUrl.searchParams.get("report") ?? "trial-balance";
  const accountId = request.nextUrl.searchParams.get("accountId");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const dateFilter =
    from || to
      ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59`) : undefined }
      : undefined;

  // Defter-i Kebir — tek hesabın hareketleri + yürüyen bakiye.
  if (report === "ledger") {
    if (!accountId) return NextResponse.json({ message: "accountId zorunludur" }, { status: 400 });
    const data = await withBranchTenantContext(actor, async (tx) => {
      const account = await tx.accountingAccount.findUnique({ where: { id: accountId } });
      if (!account) return null;
      const lines = await tx.journalLine.findMany({
        where: { accountId, journalEntry: { entryDate: dateFilter } },
        include: { journalEntry: { select: { no: true, entryDate: true, description: true } } },
        orderBy: [{ journalEntry: { entryDate: "asc" } }, { journalEntry: { no: "asc" } }],
      });
      const debitNormal = account.normalBalance === "BORC";
      let running = 0;
      const rows = lines.map((l) => {
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        running += debitNormal ? debit - credit : credit - debit;
        return {
          no: l.journalEntry.no,
          entryDate: l.journalEntry.entryDate.toISOString(),
          description: l.description ?? l.journalEntry.description,
          debit,
          credit,
          balance: round2(running),
        };
      });
      return {
        account: { id: account.id, code: account.code, name: account.name, normalBalance: account.normalBalance },
        rows,
        totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)),
        totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)),
        balance: round2(running),
      };
    });
    if (!data) return NextResponse.json({ message: "Hesap bulunamadı" }, { status: 404 });
    return NextResponse.json(data);
  }

  // Diğer raporlar için: hesap bazlı borç/alacak toplamları.
  const accounts = await withBranchTenantContext(actor, async (tx) => {
    const accs = await tx.accountingAccount.findMany({ orderBy: { code: "asc" } });
    const lines = await tx.journalLine.findMany({
      where: { journalEntry: { entryDate: dateFilter } },
      select: { accountId: true, debit: true, credit: true },
    });
    const byAcc = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      const cur = byAcc.get(l.accountId) ?? { debit: 0, credit: 0 };
      cur.debit += Number(l.debit);
      cur.credit += Number(l.credit);
      byAcc.set(l.accountId, cur);
    }
    return accs.map((a) => {
      const t = byAcc.get(a.id) ?? { debit: 0, credit: 0 };
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        normalBalance: a.normalBalance,
        debit: round2(t.debit),
        credit: round2(t.credit),
      };
    });
  });

  // Mizan — tüm hesaplar, hareketi olan (veya tümü) borç/alacak/bakiye.
  if (report === "trial-balance") {
    const rows = accounts
      .filter((a) => a.debit !== 0 || a.credit !== 0)
      .map((a) => ({ ...a, balance: round2(a.debit - a.credit) }));
    return NextResponse.json({
      rows,
      totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)),
      totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)),
    });
  }

  // Gelir Tablosu — gelir (alacak-borç) - gider (borç-alacak) = net kâr.
  if (report === "income-statement") {
    const revenue = accounts
      .filter((a) => a.type === AccountType.GELIR)
      .map((a) => ({ code: a.code, name: a.name, amount: round2(a.credit - a.debit) }))
      .filter((r) => r.amount !== 0);
    const expense = accounts
      .filter((a) => a.type === AccountType.GIDER || a.type === AccountType.MALIYET)
      .map((a) => ({ code: a.code, name: a.name, amount: round2(a.debit - a.credit) }))
      .filter((r) => r.amount !== 0);
    const totalRevenue = round2(revenue.reduce((s, r) => s + r.amount, 0));
    const totalExpense = round2(expense.reduce((s, r) => s + r.amount, 0));
    return NextResponse.json({
      revenue,
      expense,
      totalRevenue,
      totalExpense,
      netProfit: round2(totalRevenue - totalExpense),
    });
  }

  // Bilanço — Aktif (varlıklar) = Pasif (yabancı kaynak + özkaynak + dönem kârı).
  if (report === "balance-sheet") {
    const assets = accounts
      .filter((a) => a.type === AccountType.VARLIK)
      .map((a) => ({ code: a.code, name: a.name, amount: round2(a.debit - a.credit) }))
      .filter((r) => r.amount !== 0);
    const liabilities = accounts
      .filter((a) => a.type === AccountType.YABANCI_KAYNAK)
      .map((a) => ({ code: a.code, name: a.name, amount: round2(a.credit - a.debit) }))
      .filter((r) => r.amount !== 0);
    const equity = accounts
      .filter((a) => a.type === AccountType.OZKAYNAK)
      .map((a) => ({ code: a.code, name: a.name, amount: round2(a.credit - a.debit) }))
      .filter((r) => r.amount !== 0);

    // Dönem net kârı (gelir - gider) özkaynağa eklenir (henüz 590'a devredilmemişse).
    const totalRevenue = round2(accounts.filter((a) => a.type === AccountType.GELIR).reduce((s, a) => s + (a.credit - a.debit), 0));
    const totalExpense = round2(accounts.filter((a) => a.type === AccountType.GIDER || a.type === AccountType.MALIYET).reduce((s, a) => s + (a.debit - a.credit), 0));
    const netProfit = round2(totalRevenue - totalExpense);
    if (netProfit !== 0) equity.push({ code: "590", name: "Dönem Net Kârı/Zararı", amount: netProfit });

    const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
    const totalLiabilities = round2(liabilities.reduce((s, r) => s + r.amount, 0));
    const totalEquity = round2(equity.reduce((s, r) => s + r.amount, 0));
    return NextResponse.json({
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalPassive: round2(totalLiabilities + totalEquity),
    });
  }

  return NextResponse.json({ message: "Geçersiz rapor türü" }, { status: 400 });
}
