import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { vatBreakdown } from "@/lib/tax";

/**
 * KDV özet raporu — şubenin Muhasebe defterindeki KDV'ye tabi (vatRate ≠
 * null) kayıtlarını Hesaplanan KDV (GELIR) / İndirilecek KDV (GIDER) olarak
 * ayırıp Ödenecek/Devreden KDV'yi hesaplar. Gerçek bir GİB/e-Beyanname
 * entegrasyonu DEĞİLDİR — yalnızca sayıları doğru hesaplayıp raporlar.
 *
 * `?from=` / `?to=` (ISO tarih) verilirse yalnızca o aralıktaki entryDate'ler
 * dahil edilir; hiçbiri verilmezse tüm zamanların özeti döner.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol KDV özetini görüntüleyemez" }, { status: 403 });
  }

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const from = fromParam && !isNaN(Date.parse(fromParam)) ? new Date(fromParam) : null;
  const to = toParam && !isNaN(Date.parse(toParam)) ? new Date(toParam) : null;

  const entries = await withTenantContext(actor, (tx) =>
    tx.accountingLedgerEntry.findMany({
      where: {
        vatRate: { not: null },
        ...(from || to ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { entryDate: "desc" },
    }),
  );

  let hesaplananKdv = 0; // GELIR üzerinden — satışa/hizmete yansıtılan KDV
  let indirilecekKdv = 0; // GIDER üzerinden — ödenen KDV, mahsup edilebilir
  const rows = entries.map((entry) => {
    const amount = Number(entry.amount);
    const vatRate = Number(entry.vatRate);
    const { base, vatAmount } = vatBreakdown(amount, vatRate);
    if (entry.type === "GELIR") hesaplananKdv += vatAmount;
    else indirilecekKdv += vatAmount;
    return {
      id: entry.id,
      type: entry.type,
      category: entry.category,
      entryDate: entry.entryDate,
      vatRate,
      base,
      vatAmount,
    };
  });

  hesaplananKdv = round2(hesaplananKdv);
  indirilecekKdv = round2(indirilecekKdv);
  const net = round2(hesaplananKdv - indirilecekKdv);

  return NextResponse.json({
    rows,
    summary: {
      hesaplananKdv,
      indirilecekKdv,
      // net > 0 => vergi dairesine ödenecek KDV; net < 0 => sonraki döneme devreden KDV
      odenecekKdv: net > 0 ? net : 0,
      devredenKdv: net < 0 ? round2(-net) : 0,
    },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
