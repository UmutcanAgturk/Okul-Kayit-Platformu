import { NextRequest, NextResponse } from "next/server";
import { resolveActingUser, withTenantContext } from "@/lib/db-context";

// Bir öğrencinin tüm taksitlerini (taksit no sırasına göre) listeler.
//
// Güvenlik: `requestedByUserId` ile tanımlanan kullanıcının GERÇEK (veritabanı
// kaydındaki) tenant/rolüyle RLS bağlamı kurulur — farklı bir tenant'ın
// öğrencisi istenirse RLS onu zaten görünmez kılar, "bulunamadı" ile "başkasının"
// arasında bir fark gözetilmez (bkz. collect route'undaki aynı prensip).
export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  const requestedByUserId = request.nextUrl.searchParams.get("requestedByUserId");
  if (!requestedByUserId) {
    return NextResponse.json({ message: "requestedByUserId zorunludur" }, { status: 400 });
  }

  const actor = await resolveActingUser(requestedByUserId);
  if (!actor) {
    return NextResponse.json({ message: "Geçersiz requestedByUserId" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return null;
    const installments = await tx.paymentInstallment.findMany({
      where: { studentId: params.studentId },
      orderBy: { installmentNo: "asc" },
    });
    return { studentId: params.studentId, installments };
  });

  if (!result) {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(result);
}
