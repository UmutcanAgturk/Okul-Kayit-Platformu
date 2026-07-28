import { NextRequest, NextResponse } from "next/server";
import { ReceiptMethod, ReceiptType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { formatDocumentNo } from "@/lib/documents";

/**
 * Dekont (tahsilat/ödeme makbuzu) — demo/seviye360-app.html'deki
 * createDekont()'un gerçek karşılığı. Kayıt Defteri'nden BİLİNÇLİ OLARAK
 * bağımsızdır (bkz. prisma/schema.prisma'daki "BELGELER" yorumu).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
const RECEIPT_TYPES: ReceiptType[] = [ReceiptType.TAHSILAT, ReceiptType.ODEME];
const RECEIPT_METHODS: ReceiptMethod[] = [
  ReceiptMethod.KREDI_KARTI,
  ReceiptMethod.BANKA_HAVALESI,
  ReceiptMethod.NAKIT,
  ReceiptMethod.SENET,
];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol dekontları görüntüleyemez" }, { status: 403 });
  }

  const receipts = await withTenantContext(actor, (tx) =>
    tx.receipt.findMany({ orderBy: { createdAt: "desc" } }),
  );

  return NextResponse.json({ receipts });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol dekont oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const receiptDate = typeof body.receiptDate === "string" && !isNaN(Date.parse(body.receiptDate)) ? new Date(body.receiptDate) : null;
  const type = typeof body.type === "string" && RECEIPT_TYPES.includes(body.type as ReceiptType) ? (body.type as ReceiptType) : null;
  const personName = typeof body.personName === "string" && body.personName.trim() ? body.personName.trim() : null;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : null;
  const method = typeof body.method === "string" && RECEIPT_METHODS.includes(body.method as ReceiptMethod) ? (body.method as ReceiptMethod) : null;
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!receiptDate || !type || !personName || !amount || !method) {
    return NextResponse.json(
      { message: "receiptDate, type (TAHSILAT/ODEME), personName, amount (>0) ve method zorunludur" },
      { status: 400 },
    );
  }

  const year = new Date().getFullYear();
  const receipt = await withTenantContext(actor, async (tx) => {
    // Bir INSERT'i catch(P2002) ile AYNI transaction içinde yeniden denemek
    // çalışmaz (bkz. invoices/route.ts'teki aynı yorum) — önce boş bir `no`
    // bulunur (yalnızca SELECT'lerle), INSERT en sonda ve yalnızca BİR KEZ
    // çalıştırılır.
    const count = await tx.receipt.count({ where: { tenantId: actor.tenantId! } });
    let no = formatDocumentNo("DKN", year, count + 1);
    for (let attempt = 1; attempt < 20; attempt++) {
      const existing = await tx.receipt.findUnique({ where: { tenantId_no: { tenantId: actor.tenantId!, no } } });
      if (!existing) break;
      no = formatDocumentNo("DKN", year, count + 1 + attempt);
    }

    return tx.receipt.create({
      data: { tenantId: actor.tenantId!, no, receiptDate, type, personName, amount, method, description, note, createdByUserId: actor.id },
    });
  });

  return NextResponse.json({ receipt }, { status: 201 });
}
