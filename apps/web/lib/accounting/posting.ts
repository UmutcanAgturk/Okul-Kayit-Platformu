import type { Prisma } from "@prisma/client";
import { JournalSource } from "@prisma/client";
import { STANDARD_CHART } from "./chart";

type Tx = Prisma.TransactionClient;

/**
 * Çift taraflı muhasebe — kayıt (posting) yardımcıları.
 *
 *  - `seedChartForTenant`: bir şube ilk kez muhasebe kullandığında Tekdüzen
 *    Hesap Planı'nı o tenant için oluşturur (idempotent).
 *  - `postJournal`: DENGELİ bir yevmiye fişi yazar (Σborç = Σalacak zorunlu).
 *    `source`+`sourceRefId` verilirse idempotenttir (aynı olay iki kez
 *    kaydedilmez) — otomatik kayıtlar (tahsilat/gider) için kritik.
 */

export async function seedChartForTenant(tx: Tx, tenantId: string): Promise<void> {
  const existing = await tx.accountingAccount.findMany({ where: { tenantId }, select: { code: true } });
  const have = new Set(existing.map((a) => a.code));
  const missing = STANDARD_CHART.filter((a) => !have.has(a.code));
  if (missing.length === 0) return;
  await tx.accountingAccount.createMany({
    data: missing.map((a) => ({
      tenantId,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      parentCode: a.parentCode ?? null,
    })),
    skipDuplicates: true,
  });
}

/** code → accountId eşlemesi (yoksa hesap planını tohumlar). */
export async function accountIdByCode(tx: Tx, tenantId: string): Promise<Map<string, string>> {
  let accounts = await tx.accountingAccount.findMany({ where: { tenantId }, select: { id: true, code: true } });
  if (accounts.length === 0) {
    await seedChartForTenant(tx, tenantId);
    accounts = await tx.accountingAccount.findMany({ where: { tenantId }, select: { id: true, code: true } });
  }
  return new Map(accounts.map((a) => [a.code, a.id]));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function nextJournalNo(tx: Tx, tenantId: string, year: number): Promise<string> {
  const prefix = `YEV-${year}-`;
  const count = await tx.journalEntry.count({ where: { tenantId, no: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export interface JournalLineInput {
  code: string; // hesap kodu (chart.ACC)
  debit?: number; // borç
  credit?: number; // alacak
  description?: string;
}

export interface PostJournalInput {
  tenantId: string;
  entryDate: Date;
  description: string;
  source?: JournalSource;
  sourceRefId?: string | null;
  createdByUserId?: string | null;
  lines: JournalLineInput[];
}

export class JournalUnbalancedError extends Error {}

/**
 * Dengeli yevmiye fişi yazar. `source`+`sourceRefId` verilmişse ve o kaynak
 * için zaten bir fiş varsa yeni fiş açmaz (idempotent) — mevcut fişin id'sini
 * döndürür. Σborç ≠ Σalacak ise JournalUnbalancedError fırlatır.
 */
export async function postJournal(tx: Tx, input: PostJournalInput): Promise<string> {
  const { tenantId, source, sourceRefId } = input;

  if (source && sourceRefId) {
    const existing = await tx.journalEntry.findFirst({
      where: { tenantId, source, sourceRefId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const lines = input.lines
    .map((l) => ({ code: l.code, debit: round2(l.debit ?? 0), credit: round2(l.credit ?? 0), description: l.description ?? null }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (lines.length < 2 || totalDebit !== totalCredit || totalDebit === 0) {
    throw new JournalUnbalancedError(`Yevmiye dengesiz: borç ${totalDebit} ≠ alacak ${totalCredit}`);
  }

  const codeToId = await accountIdByCode(tx, tenantId);
  const resolved = lines.map((l) => {
    const accountId = codeToId.get(l.code);
    if (!accountId) throw new Error(`Hesap bulunamadı: ${l.code}`);
    return { accountId, debit: l.debit, credit: l.credit, description: l.description };
  });

  // no üretimi — nadir yarış için birkaç kez dener.
  const year = input.entryDate.getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await nextJournalNo(tx, tenantId, year);
    try {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          no,
          entryDate: input.entryDate,
          description: input.description,
          source: source ?? JournalSource.MANUEL,
          sourceRefId: sourceRefId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          lines: { create: resolved },
        },
      });
      return entry.id;
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("Yevmiye numarası üretilemedi");
}

/**
 * Otomatik kayıt: en iyi çaba — asla ana işlemi (tahsilat/gider) düşürmez.
 * Hata olursa yutar (yevmiye eksik kalır, kullanıcı elle ekleyebilir).
 */
export async function tryPostJournal(tx: Tx, input: PostJournalInput): Promise<void> {
  try {
    await postJournal(tx, input);
  } catch {
    /* best-effort — otomatik kayıt başarısız olsa da ana işlem sürer */
  }
}
