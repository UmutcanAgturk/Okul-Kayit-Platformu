import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * `../route.ts`'teki GET/POST'a eksik kalan DELETE — demo'daki (seviye360-app.html)
 * Kayıt Defteri satırlarının silinebilmesiyle birebir aynı yetenek, ama burada
 * gerçek Postgres + RLS'ye karşı. RLS zaten `entryId`'nin actor'ün tenant'ına
 * ait olmayan bir satırı hiç görünür kılmaz (bkz. accounting-ledger GET'teki
 * "bulunamadı ile başkasının arasındaki fark ayırt edilmez" notu) — o yüzden
 * burada da `not_found` tek bir 404'e düşer.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function DELETE(request: NextRequest, { params }: { params: { entryId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol Muhasebe defterinden kayıt silemez" }, { status: 403 });
  }

  try {
    const outcome = await withTenantContext(actor, async (tx) => {
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
