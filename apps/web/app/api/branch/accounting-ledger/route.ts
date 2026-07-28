import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { vatBreakdown, withholdingBreakdown } from "@/lib/tax";

/**
 * Dördüncü gerçek modül: Muhasebe defteri. `AccountingLedgerEntry` tablosu
 * zaten diğerlerinden farklı bir RLS politikasına sahipti (bkz.
 * prisma/rls/README.md — yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING
 * sorgulayabilir), ama şimdiye kadar buna karşı çalışan bir API yoktu —
 * yalnızca taksit tahsilatı route'u dolaylı olarak buraya satır yazıyordu.
 * Bu route, aynı deseni (gerçek Postgres + RLS + oturum tabanlı kimlik)
 * doğrudan bu tabloya uygular.
 *
 * SUPERADMIN kasıtlı olarak dışarıda bırakıldı: bu route `/api/branch/...`
 * altında, TEK bir şubenin defterini hedefler; SUPERADMIN'in `tenantId`'si
 * olmadığından (Genel Merkez, tek bir tenant'a bağlı değildir) hem "hangi
 * şubenin defteri" sorusu hem de POST'ta hangi tenantId'ye yazılacağı
 * belirsiz kalırdı — Genel Merkez'in konsolide görünümü kapsam dışıdır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol Muhasebe defterini görüntüleyemez" }, { status: 403 });
  }

  const entries = await withTenantContext(actor, (tx) =>
    tx.accountingLedgerEntry.findMany({ orderBy: { entryDate: "desc" } }),
  );

  const totalGelir = entries.filter((e) => e.type === "GELIR").reduce((sum, e) => sum + Number(e.amount), 0);
  const totalGider = entries.filter((e) => e.type === "GIDER").reduce((sum, e) => sum + Number(e.amount), 0);

  // vatRate/withholdingRate saklanan tek gerçek kaynak — matrah/KDV/net
  // ödenecek tutar her okumada bu ham orandan türetilir (bkz. lib/tax.ts).
  const entriesWithTax = entries.map((entry) => {
    const amount = Number(entry.amount);
    const vatRate = entry.vatRate === null ? null : Number(entry.vatRate);
    const withholdingRate = entry.withholdingRate === null ? null : Number(entry.withholdingRate);
    return {
      ...entry,
      tax: {
        ...vatBreakdown(amount, vatRate),
        ...withholdingBreakdown(amount, withholdingRate),
      },
    };
  });

  return NextResponse.json({
    entries: entriesWithTax,
    summary: { totalGelir, totalGider, net: totalGelir - totalGider },
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol Muhasebe defterine kayıt ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type === "GELIR" || body.type === "GIDER" ? body.type : null;
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : null;
  const entryDate = typeof body.entryDate === "string" && !isNaN(Date.parse(body.entryDate)) ? new Date(body.entryDate) : null;
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!type || !category || !amount || !entryDate) {
    return NextResponse.json(
      { message: "type (GELIR/GIDER), category, amount (>0) ve entryDate zorunludur" },
      { status: 400 },
    );
  }

  // vatRate/withholdingRate isteğe bağlıdır — verilmezse KDV/stopaj dışı
  // (örn. lisanslı eğitim kurumunun eğitim geliri, KDV Kanunu 17/2-b istisnası).
  const vatRate = isValidRate(body.vatRate) ? body.vatRate : null;
  const withholdingRate = isValidRate(body.withholdingRate) ? body.withholdingRate : null;
  if (body.vatRate !== undefined && body.vatRate !== null && !isValidRate(body.vatRate)) {
    return NextResponse.json({ message: "vatRate 0 ile 1 arasında bir sayı olmalıdır" }, { status: 400 });
  }
  if (body.withholdingRate !== undefined && body.withholdingRate !== null && !isValidRate(body.withholdingRate)) {
    return NextResponse.json({ message: "withholdingRate 0 ile 1 arasında bir sayı olmalıdır" }, { status: 400 });
  }

  const entry = await withTenantContext(actor, (tx) =>
    tx.accountingLedgerEntry.create({
      data: {
        tenantId: actor.tenantId!,
        type,
        category,
        amount,
        entryDate,
        note,
        vatRate,
        withholdingRate,
        createdByUserId: actor.id,
      },
    }),
  );

  return NextResponse.json({ entry }, { status: 201 });
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}
