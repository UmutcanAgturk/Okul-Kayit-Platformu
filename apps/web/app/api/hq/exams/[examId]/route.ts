import { NextRequest, NextResponse } from "next/server";
import { ExamScope, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

const ROLES_ALLOWED: UserRole[] = [UserRole.SUPERADMIN];

/**
 * Genel Sınav düzenleme — demo'daki examEditingId akışının karşılığı.
 * Demo'da olduğu gibi kapsam (branchIds/eligibleGradeLevels) BİLİNÇLİ olarak
 * düzenlenemez: "Kapsam değişikliği için sınavı silip yeniden tanımlayın."
 * — kapsamı değiştirmek zaten oluşturulmuş ExamBranchDispatch/ExamResult
 * satırlarıyla tutarsızlığa yol açardı.
 */
export async function PATCH(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez Genel Sınav düzenleyebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  const examDate = typeof body.examDate === "string" && !isNaN(Date.parse(body.examDate)) ? new Date(body.examDate) : undefined;
  const bookletTypes = body.bookletCount === 2 ? ["A", "B"] : body.bookletCount === 4 ? ["A", "B", "C", "D"] : undefined;
  const feePerStudent = typeof body.feePerStudent === "number" && body.feePerStudent >= 0 ? body.feePerStudent : body.feePerStudent === null ? null : undefined;

  const outcome = await withTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam || exam.scope !== ExamScope.NETWORK) return null;

    const updated = await tx.exam.update({
      where: { id: exam.id },
      data: { name, examDate, bookletTypes, feePerStudent },
    });

    await logActivity(tx, {
      tenantId: exam.tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Genel Sınav düzenlendi",
      detail: updated.name,
    });

    return { exam: updated };
  });

  if (!outcome) {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
    exam: {
      id: outcome.exam.id,
      name: outcome.exam.name,
      examDate: outcome.exam.examDate.toISOString().slice(0, 10),
      bookletTypes: outcome.exam.bookletTypes,
      eligibleGradeLevels: outcome.exam.eligibleGradeLevels,
      feePerStudent: outcome.exam.feePerStudent,
    },
  });
}

/**
 * Genel Sınav silme — demo'daki examDeletingId akışının karşılığı. ExamQuestion
 * ve ExamBranchDispatch kayıtları onDelete: Cascade ile otomatik silinir; ama
 * ExamResult (GERÇEK öğrenci sonuçları) RESTRICT'tir — bir öğrenci bu sınava
 * ait bir sonuç girmişse silme 409 ile reddedilir (demo'nun "geri alınamaz"
 * uyarısını, sonuç varsa hiç silmeye izin vermeyerek daha güvenli hale getirir).
 */
export async function DELETE(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez Genel Sınav silebilir" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: params.examId } });
    if (!exam || exam.scope !== ExamScope.NETWORK) return { kind: "not_found" as const };

    const resultCount = await tx.examResult.count({ where: { examId: exam.id } });
    if (resultCount > 0) return { kind: "has_results" as const };

    await tx.exam.delete({ where: { id: exam.id } });

    await logActivity(tx, {
      tenantId: exam.tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Genel Sınav silindi",
      detail: exam.name,
    });

    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "has_results") {
    return NextResponse.json({ message: "Bu sınava ait öğrenci sonuçları girildiği için silinemez." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
