import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Oturumdaki kullanıcının kim olduğunu ve rolüne özgü kendi kaynak
 * kimliklerini (studentProfile.id, teacherProfile.id, bağlı öğrenciler)
 * döner. Diğer route'lar (`/api/students/[studentId]/installments` gibi)
 * bu ID'lerin zaten bilindiğini varsayıyor — bir istemcinin (mobil dahil)
 * "benim öğrenci/öğretmen kaydım hangisi?" sorusunu cevaplayacak başka bir
 * endpoint yoktu.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  let actingTenantName: string | null = null;
  if (actor.role === UserRole.SUPERADMIN && actor.actingTenantId) {
    const actingTenant = await withTenantContext(actor, (tx) => tx.tenant.findUnique({ where: { id: actor.actingTenantId! } }));
    actingTenantName = actingTenant?.name ?? null;
  }

  const base = {
    id: actor.id,
    email: actor.email,
    firstName: actor.firstName,
    lastName: actor.lastName,
    role: actor.role,
    tenantId: actor.tenantId,
    actingTenantId: actor.actingTenantId,
    actingTenantName,
    twoFactorEnabled: actor.totpEnabled,
  };

  if (actor.role === UserRole.STUDENT) {
    const studentProfile = await withTenantContext(actor, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: actor.id } }),
    );
    return NextResponse.json({
      ...base,
      students: studentProfile
        ? [{ studentId: studentProfile.id, fullName: `${actor.firstName} ${actor.lastName}` }]
        : [],
    });
  }

  if (actor.role === UserRole.PARENT) {
    const guardianRows = await withTenantContext(actor, (tx) =>
      tx.studentGuardian.findMany({
        where: { parent: { userId: actor.id } },
        include: { student: { include: { user: true } } },
      }),
    );
    return NextResponse.json({
      ...base,
      students: guardianRows.map((row) => ({
        studentId: row.studentId,
        fullName: `${row.student.user.firstName} ${row.student.user.lastName}`,
        relation: row.relation,
      })),
    });
  }

  if (actor.role === UserRole.TEACHER) {
    const teacherProfile = await withTenantContext(actor, (tx) =>
      tx.teacherProfile.findUnique({ where: { userId: actor.id } }),
    );
    return NextResponse.json({ ...base, teacherId: teacherProfile?.id ?? null });
  }

  return NextResponse.json(base);
}
