import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * "Kurum Yönetimi" (hq:kurumlar) — demo'daki gibi kurum oluşturma/silme
 * yapmaz (yeni bir tenant, gerçek bir müdür hesabı + kimlik bilgisi
 * gerektirir; bu ayrı bir iş) — bu ilk sürüm SALT OKUNUR bir envanterdir:
 * Genel Merkez'in gördüğü tüm kurumların gerçek Postgres verisinden anlık
 * öğrenci/öğretmen/personel/sınıf sayıları ve şube müdürü bilgisi.
 * `withTenantContext` SUPERADMIN için `superadmin_role` (BYPASSRLS)
 * bağlantısına geçtiğinden tüm tenant'lar tek sorguda görülebilir (bkz.
 * lib/db-context.ts ve app/api/hq/accounting-ledger/route.ts'teki aynı not).
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kurum listesini görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const tenants = await tx.tenant.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });

    const [students, classrooms, staff, teachers, branchAdmins] = await Promise.all([
      tx.studentProfile.findMany({ select: { tenantId: true } }),
      tx.classroom.findMany({ select: { tenantId: true } }),
      tx.staffProfile.findMany({ select: { tenantId: true } }),
      tx.teacherProfile.findMany({ select: { user: { select: { tenantId: true } } } }),
      tx.user.findMany({ where: { role: UserRole.BRANCH_ADMIN }, select: { tenantId: true, firstName: true, lastName: true } }),
    ]);

    const countBy = (rows: { tenantId: string | null }[]) => {
      const map = new Map<string, number>();
      for (const r of rows) {
        if (!r.tenantId) continue;
        map.set(r.tenantId, (map.get(r.tenantId) ?? 0) + 1);
      }
      return map;
    };

    const studentCounts = countBy(students);
    const classroomCounts = countBy(classrooms);
    const staffCounts = countBy(staff);
    const teacherCounts = countBy(teachers.map((t) => ({ tenantId: t.user.tenantId })));
    const branchAdminByTenant = new Map(branchAdmins.filter((u) => u.tenantId).map((u) => [u.tenantId as string, `${u.firstName} ${u.lastName}`]));

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      type: t.type,
      city: t.city,
      district: t.district,
      isActive: t.isActive,
      studentCount: studentCounts.get(t.id) ?? 0,
      classroomCount: classroomCounts.get(t.id) ?? 0,
      staffCount: staffCounts.get(t.id) ?? 0,
      teacherCount: teacherCounts.get(t.id) ?? 0,
      branchAdminName: branchAdminByTenant.get(t.id) ?? null,
    }));
  });

  return NextResponse.json({ tenants: result });
}
