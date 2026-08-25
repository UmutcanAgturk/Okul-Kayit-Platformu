import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, effectiveTenantIdOrNull, tenantScopeFilter } from "@/lib/db-context";
import { reportResponse } from "@/lib/report-export";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Personel Listesi" CSV kartı — `StaffProfile` (Şube Müdürü/Ön Büro/
 * Muhasebe/Rehber Öğretmen) ve `TeacherProfile` (Öğretmen) birlikte
 * listelenir, demo'daki `CURRENT_BRANCH.staff`'ın (rol ayrımı olmaksızın
 * tek liste) karşılığı.
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

  const fmtLabel = ["xlsx", "excel"].includes((request.nextUrl.searchParams.get("format") ?? "").toLowerCase()) ? "Excel" : "CSV";
  const report = await withBranchTenantContext(actor, async (tx) => {
    const staff = await tx.staffProfile.findMany({ include: { user: true } });
    const teachers = await tx.teacherProfile.findMany({
      where: { user: { ...tenantScopeFilter(actor), role: UserRole.TEACHER } },
      include: { user: true },
    });

    const rows = [
      ...staff.map((s) => [`${s.user.firstName} ${s.user.lastName}`, s.title, s.department ?? "—", s.user.phone ?? "—", s.user.isActive ? "Aktif" : "Pasif"]),
      ...teachers.map((t) => [`${t.user.firstName} ${t.user.lastName}`, "Öğretmen", t.branch, t.user.phone ?? "—", t.user.isActive ? "Aktif" : "Pasif"]),
    ];
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "tr"));

    await logActivity(tx, {
      tenantId: effectiveTenantIdOrNull(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Rapor indirildi",
      detail: `Personel Listesi ()`,
    });

    return { headers: ["Ad Soyad", "Rol", "Branş/Departman", "Telefon", "Durum"], rows };
  });

  return reportResponse(request, "personel_listesi", "Personel Listesi", report.headers, report.rows);
}
