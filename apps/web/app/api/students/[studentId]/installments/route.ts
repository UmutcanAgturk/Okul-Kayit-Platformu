import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

// Bir öğrencinin tüm taksitlerini (taksit no sırasına göre) listeler.
//
// Güvenlik: kimlik /api/auth/login ile alınan oturum çerezinden gelir (bkz.
// lib/session.ts) — istemcinin beyan ettiği bir kullanıcı kimliğine değil.
// RLS bağlamı bu doğrulanmış kullanıcının gerçek tenant/rolüyle kurulur;
// farklı bir tenant'ın öğrencisi istenirse RLS onu zaten görünmez kılar,
// "bulunamadı" ile "başkasının" arasında bir fark gözetilmez.
export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
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
