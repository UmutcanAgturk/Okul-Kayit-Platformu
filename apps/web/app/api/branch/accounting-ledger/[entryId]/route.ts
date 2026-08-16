import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * `../route.ts`'teki GET/POST'a eksik kalan DELETE — demo'daki (seviye360-app.html)
 * Kayıt Defteri satırlarının silinebilmesiyle birebir aynı yetenek, ama burada
 * gerçek Postgres + RLS'ye karşı. RLS zaten `entryId`'nin actor'ün tenant'ına
 * ait olmayan bir satırı hiç görünür kılmaz (bkz. accounting-ledger GET'teki
 * "bulunamadı ile başkasının arasındaki fark ayırt edilmez" notu) — o yüzden
 * burada da `not_found` tek bir 404'e düşer.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function PATCH(request: NextRequest, { params }: { params: { entryId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe defteri kaydını düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type === "GELIR" || body.type === "GIDER" ? body.type : null;
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : null;
  const entryDate = typeof body.entryDate === "string" && !isNaN(Date.parse(body.entryDate)) ? new Date(body.entryDate) : null;

  if (!type || !category || !amount || !entryDate) {
    return NextResponse.json(
      { message: "type (GELIR/GIDER), category, amount (>0) ve entryDate zorunludur" },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const vatRate = isValidRate(body.vatRate) ? body.vatRate : null;
  const withholdingRate = isValidRate(body.withholdingRate) ? body.withholdingRate : null;
  if (body.vatRate !== undefined && body.vatRate !== null && !isValidRate(body.vatRate)) {
    return NextResponse.json({ message: "vatRate 0 ile 1 arasında bir sayı olmalıdır" }, { status: 400 });
  }
  if (body.withholdingRate !== undefined && body.withholdingRate !== null && !isValidRate(body.withholdingRate)) {
    return NextResponse.json({ message: "withholdingRate 0 ile 1 arasında bir sayı olmalıdır" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const existing = await tx.accountingLedgerEntry.findUnique({ where: { id: params.entryId } });
    if (!existing) return { kind: "not_found" as const };
    const entry = await tx.accountingLedgerEntry.update({
      where: { id: params.entryId },
      data: { type, category, amount, entryDate, note, vatRate, withholdingRate },
    });
    return { kind: "updated" as const, entry };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kayıt bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ entry: outcome.entry });
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

export async function DELETE(request: NextRequest, { params }: { params: { entryId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe defterinden kayıt silemez" }, { status: 403 });
  }

  try {
    const outcome = await withBranchTenantContext(actor, async (tx) => {
      const entry = await tx.accountingLedgerEntry.findUnique({ where: { id: params.entryId } });
      if (!entry) return { kind: "not_found" as const };
      await tx.accountingLedgerEntry.delete({ where: { id: params.entryId } });
      return { kind: "deleted" as const };
    });

    if (outcome.kind === "not_found") {
      return NextResponse.json({ message: "Kayıt bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // P2003: bir PayrollRecord bu kaydı ledgerEntryId ile referans ediyor —
    // önce ilgili bordro kaydı silinmeden bu satır kaldırılamaz.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "Bu kayıt bir bordro kaydına bağlı olduğu için doğrudan silinemez." },
        { status: 409 },
      );
    }
    throw error;
  }
}
