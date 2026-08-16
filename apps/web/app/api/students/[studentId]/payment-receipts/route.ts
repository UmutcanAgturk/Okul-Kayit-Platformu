import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
// Demo'nun kendi istemci-taraflı ~2,5MB dosya boyutu sınırıyla aynı (bkz.
// seviye360-app.html renderGuardianTransferFlow — file.size > 2500000).
// Base64 kodlaması ham boyutu ~%37 büyüttüğü için data URL uzunluğu buna göre sınırlanır.
const MAX_DATA_URL_LENGTH = 3_500_000;

/**
 * Ödeme Yöntemleri — Dekont Gönderme. demo/seviye360-app.html'deki
 * "renderGuardianTransferFlow" ekranının gerçek karşılığı: velinin (yalnızca
 * faturalama sorumlusu) bir banka havalesi dekontu yükleyip şube onayına
 * sunması. Onay/red akışı app/api/branch/payment-receipts/[id]/review'da.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (actor.role !== UserRole.BRANCH_ADMIN && actor.role !== UserRole.ACCOUNTING && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const receipts = await tx.paymentReceipt.findMany({
      where: { studentId: student.id },
      orderBy: { submittedAt: "desc" },
    });
    return { kind: "ok" as const, receipts };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin dekontlarını görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json({
    receipts: result.receipts.map((r) => ({
      id: r.id,
      installmentId: r.installmentId,
      fileName: r.fileName,
      note: r.note,
      status: r.status,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Yalnızca veli dekont gönderebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const installmentId = typeof body.installmentId === "string" && body.installmentId ? body.installmentId : null;
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : null;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : null;
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!installmentId || !fileName || !mimeType || !dataUrl) {
    return NextResponse.json({ message: "installmentId, fileName, mimeType, dataUrl zorunludur" }, { status: 400 });
  }
  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json({ message: "Yalnızca resim veya PDF dosyaları kabul edilir" }, { status: 400 });
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ message: "Dosya çok büyük (limit ~2,5MB)" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
    const guardianRow = parentProfile
      ? await tx.studentGuardian.findUnique({
          where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
        })
      : null;
    if (!guardianRow || !guardianRow.isBillingResponsible) {
      return { kind: "forbidden" as const };
    }

    const installment = await tx.paymentInstallment.findUnique({ where: { id: installmentId } });
    if (!installment || installment.studentId !== student.id) {
      return { kind: "invalid_installment" as const };
    }
    if (installment.status !== PaymentStatus.PENDING) {
      return { kind: "not_pending" as const, status: installment.status };
    }

    const receipt = await tx.paymentReceipt.create({
      data: {
        tenantId: installment.tenantId,
        studentId: student.id,
        installmentId: installment.id,
        fileName,
        mimeType,
        dataUrl,
        note,
      },
    });
    return { kind: "created" as const, receipt };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin faturalama sorumlusu velisi değilsiniz" }, { status: 403 });
  }
  if (outcome.kind === "invalid_installment") {
    return NextResponse.json({ message: "Geçersiz taksit" }, { status: 400 });
  }
  if (outcome.kind === "not_pending") {
    return NextResponse.json({ message: `Bu taksit zaten "${outcome.status}" durumunda — dekont gönderilemez.` }, { status: 409 });
  }

  return NextResponse.json(
    {
      receipt: {
        id: outcome.receipt.id,
        installmentId: outcome.receipt.installmentId,
        fileName: outcome.receipt.fileName,
        note: outcome.receipt.note,
        status: outcome.receipt.status,
        submittedAt: outcome.receipt.submittedAt,
        reviewedAt: outcome.receipt.reviewedAt,
      },
    },
    { status: 201 },
  );
}
