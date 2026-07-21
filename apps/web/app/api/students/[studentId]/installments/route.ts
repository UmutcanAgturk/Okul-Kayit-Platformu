import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Bir öğrencinin tüm taksitlerini (taksit no sırasına göre) listeler —
// tahsilat ekranının roster'ı ve bu API'yi test eden entegrasyon testi
// tarafından kullanılır.
export async function GET(
  _request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  const student = await prisma.studentProfile.findUnique({ where: { id: params.studentId } });
  if (!student) {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }

  const installments = await prisma.paymentInstallment.findMany({
    where: { studentId: params.studentId },
    orderBy: { installmentNo: "asc" },
  });

  return NextResponse.json({ studentId: params.studentId, installments });
}
