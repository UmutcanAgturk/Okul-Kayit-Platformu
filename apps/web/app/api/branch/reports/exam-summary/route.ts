import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, effectiveTenantIdOrNull } from "@/lib/db-context";
import { toCsv } from "@/lib/csv";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Sınav Sonuçları Özeti" CSV kartı — öğrenci bazlı, gerçek `ExamResult`
 * verisinden sınav sayısı ve genel ortalama net.
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

  const csv = await withBranchTenantContext(actor, async (tx) => {
    const students = await tx.studentProfile.findMany({
      include: { user: true, classroom: true, examResults: true },
      orderBy: { user: { firstName: "asc" } },
    });

    const rows = students.map((s) => {
      const examCount = s.examResults.length;
      const avgNet = examCount > 0 ? Number((s.examResults.reduce((sum, r) => sum + r.netScore, 0) / examCount).toFixed(2)) : "—";
      return [s.studentNo, `${s.user.firstName} ${s.user.lastName}`, s.classroom?.name ?? "—", examCount, avgNet];
    });

    await logActivity(tx, {
      tenantId: effectiveTenantIdOrNull(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Rapor indirildi",
      detail: "Sınav Sonuçları Özeti (CSV)",
    });

    return toCsv(["Öğrenci No", "Ad Soyad", "Sınıf", "Sınav Sayısı", "Genel Ortalama Net"], rows);
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sinav_sonuclari_ozeti.csv"',
    },
  });
}
