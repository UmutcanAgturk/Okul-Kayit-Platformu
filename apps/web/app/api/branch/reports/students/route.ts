import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { toCsv } from "@/lib/csv";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Raporlar / Dışa Aktarım Merkezi — demo'daki "branch:raporlar" ekranının
 * "Öğrenci Listesi" CSV kartının karşılığı. Yeni bir Prisma modeli EKLEMEZ —
 * mevcut StudentProfile/StudentGuardian/PaymentInstallment verisinden anında
 * bir CSV üretir (bkz. demo'daki "Yeni veri modeli gerektirmez" notuyla aynı
 * ilke — Bugün Özeti/Öğretmen Performansı gibi). Yalnızca BRANCH_ADMIN erişir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol bu raporu indiremez" }, { status: 403 });
  }

  const today = new Date();
  const csv = await withBranchTenantContext(actor, async (tx) => {
    const students = await tx.studentProfile.findMany({
      include: {
        user: true,
        classroom: true,
        guardians: { include: { parent: { include: { user: true } } } },
        installments: true,
      },
      orderBy: { user: { firstName: "asc" } },
    });

    const rows = students.map((s) => {
      const guardianRow = s.guardians.find((g) => g.isBillingResponsible) ?? s.guardians[0];
      const guardianUser = guardianRow?.parent.user;
      const hasOverdue = s.installments.some((i) => i.status === PaymentStatus.PENDING && i.dueDate < today);
      const hasPending = s.installments.some((i) => i.status === PaymentStatus.PENDING);
      const paymentStatus = s.installments.length === 0 ? "Taksit Yok" : hasOverdue ? "Gecikmiş" : hasPending ? "Planlı" : "Güncel";
      return [
        s.studentNo,
        `${s.user.firstName} ${s.user.lastName}`,
        s.classroom?.name ?? "—",
        guardianUser ? `${guardianUser.firstName} ${guardianUser.lastName}` : "—",
        guardianUser?.phone ?? "—",
        paymentStatus,
      ];
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Rapor indirildi",
      detail: "Öğrenci Listesi (CSV)",
    });

    return toCsv(["Öğrenci No", "Ad Soyad", "Sınıf", "Veli", "Veli Telefon", "Ödeme Durumu"], rows);
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ogrenci_listesi.csv"',
    },
  });
}
