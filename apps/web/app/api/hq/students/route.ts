import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrenciler — Tüm Şubeler — demo'daki "hq:students" ekranının gerçek
 * karşılığı. Yeni bir Prisma modeli EKLEMEZ. `withTenantContext` SUPERADMIN
 * için `superadmin_role` (BYPASSRLS) bağlantısına geçtiğinden tüm tenant'lar
 * tek sorguda görülebilir (Kurum Yönetimi/Muhasebe konsolide görünümüyle
 * aynı desen). "Net" sütunu, Raporlar/Sınav Sonuçları Özeti'ndeki gibi
 * öğrencinin tüm ExamResult kayıtlarının ortalamasıdır.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez tüm şubelerdeki öğrencileri görüntüleyebilir" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const tenantIdFilter = request.nextUrl.searchParams.get("tenantId") || "";

  const result = await withTenantContext(actor, async (tx) => {
    const students = await tx.studentProfile.findMany({
      include: { user: true, tenant: true, classroom: true, examResults: { select: { netScore: true } } },
      orderBy: { user: { firstName: "asc" } },
    });

    const byTenant = new Map<string, { name: string; count: number }>();
    for (const s of students) {
      const entry = byTenant.get(s.tenantId) ?? { name: s.tenant.name, count: 0 };
      entry.count += 1;
      byTenant.set(s.tenantId, entry);
    }
    const branches = Array.from(byTenant.values());
    const busiest = branches.reduce((a, b) => (b.count > a.count ? b : a), branches[0] ?? null);
    const unassignedCount = students.filter((s) => !s.classroomId).length;

    const filtered = students.filter((s) => {
      if (tenantIdFilter && s.tenantId !== tenantIdFilter) return false;
      if (!q) return true;
      const fullName = `${s.user.firstName} ${s.user.lastName}`.toLowerCase();
      return fullName.includes(q) || s.studentNo.toLowerCase().includes(q);
    });

    return {
      summary: {
        totalStudents: students.length,
        branchCount: byTenant.size,
        busiestBranch: busiest ? { name: busiest.name, count: busiest.count } : null,
        unassignedCount,
      },
      students: filtered.map((s) => {
        const avgNet = s.examResults.length > 0 ? Number((s.examResults.reduce((sum, r) => sum + r.netScore, 0) / s.examResults.length).toFixed(2)) : null;
        return {
          id: s.id,
          studentNo: s.studentNo,
          name: `${s.user.firstName} ${s.user.lastName}`,
          tenantId: s.tenantId,
          tenantName: s.tenant.name,
          gradeLevel: s.gradeLevel,
          classroomName: s.classroom?.name ?? null,
          avgNet,
        };
      }),
    };
  });

  return NextResponse.json(result);
}
