import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { formatDocumentNo, invoiceTotals } from "@/lib/documents";

/**
 * Fatura — demo/seviye360-app.html'deki createInvoice()'un gerçek karşılığı.
 * Kayıt Defteri'nden BİLİNÇLİ OLARAK bağımsızdır (bkz. prisma/schema.prisma'daki
 * "BELGELER: Fatura / Dekont / Senet" yorumu) — deftere yansıtmak isteyen
 * kullanıcı ayrıca /api/branch/accounting-ledger'a manuel bir kayıt ekler.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function parseItems(raw: unknown): InvoiceItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: InvoiceItemInput[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    const description = row?.description;
    const quantity = row?.quantity;
    const unitPrice = row?.unitPrice;
    if (typeof description !== "string" || !description) return null;
    if (typeof quantity !== "number" || quantity <= 0) return null;
    if (typeof unitPrice !== "number" || unitPrice <= 0) return null;
    items.push({ description, quantity, unitPrice });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol faturaları görüntüleyemez" }, { status: 403 });
  }

  const invoices = await withBranchTenantContext(actor, (tx) =>
    tx.invoice.findMany({ orderBy: { createdAt: "desc" } }),
  );

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol fatura oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const invoiceDate = typeof body.invoiceDate === "string" && !isNaN(Date.parse(body.invoiceDate)) ? new Date(body.invoiceDate) : null;
  const buyerName = typeof body.buyerName === "string" && body.buyerName.trim() ? body.buyerName.trim() : null;
  const buyerTaxNo = typeof body.buyerTaxNo === "string" && body.buyerTaxNo.trim() ? body.buyerTaxNo.trim() : null;
  const buyerAddress = typeof body.buyerAddress === "string" && body.buyerAddress.trim() ? body.buyerAddress.trim() : null;
  const items = parseItems(body.items);
  const kdvExempt = !!body.kdvExempt;
  const kdvRate = !kdvExempt && typeof body.kdvRate === "number" && body.kdvRate >= 0 && body.kdvRate <= 1 ? body.kdvRate : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!invoiceDate || !buyerName || !items) {
    return NextResponse.json(
      { message: "invoiceDate, buyerName ve en az bir kalem içeren items (description, quantity>0, unitPrice>0) zorunludur" },
      { status: 400 },
    );
  }
  if (!kdvExempt && kdvRate === null) {
    return NextResponse.json({ message: "KDV'den istisna değilse kdvRate (0-1 arası oran) zorunludur" }, { status: 400 });
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const { kdvAmount, total } = invoiceTotals(subtotal, kdvRate);
  const year = new Date().getFullYear();

  const invoice = await withBranchTenantContext(actor, async (tx) => {
    // Bir INSERT'i catch(P2002) ile AYNI transaction içinde yeniden denemek
    // çalışmaz — Postgres bir statement hata verdiğinde transaction'ın tamamını
    // "aborted" durumuna sokar, sonraki her statement (retry dahil) 25P02 ile
    // patlar. Bu yüzden önce boş bir `no` bulunur (yalnızca SELECT'lerle),
    // INSERT en sonda ve yalnızca BİR KEZ çalıştırılır.
    const count = await tx.invoice.count({ where: { tenantId: effectiveTenantId(actor) } });
    let no = formatDocumentNo("FT", year, count + 1);
    for (let attempt = 1; attempt < 20; attempt++) {
      const existing = await tx.invoice.findUnique({ where: { tenantId_no: { tenantId: effectiveTenantId(actor), no } } });
      if (!existing) break;
      no = formatDocumentNo("FT", year, count + 1 + attempt);
    }

    return tx.invoice.create({
      data: {
        tenantId: effectiveTenantId(actor),
        no,
        invoiceDate,
        buyerName,
        buyerTaxNo,
        buyerAddress,
        items: items as unknown as Prisma.InputJsonValue,
        kdvRate,
        subtotal,
        kdvAmount,
        total,
        note,
        createdByUserId: actor.id,
      },
    });
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
