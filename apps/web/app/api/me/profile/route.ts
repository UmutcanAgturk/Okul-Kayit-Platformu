import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { prisma } from "@/lib/prisma";

/**
 * "Profilim" ekranının veri kaynağı — demo/seviye360-app.html'deki
 * "profilim" screen'inin gerçek karşılığı. /api/me'den BİLİNÇLİ OLARAK ayrı
 * bir route: /api/me hafif ve her sayfada (AppChrome dahil) çağrılır, burada
 * ise yalnızca Profilim sayfasının ihtiyaç duyduğu ek/ağır alanlar (telefon,
 * kurum adı, role'e özgü branş/sınıf bilgisi) döner.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const tenant = actor.tenantId ? await prisma.tenant.findUnique({ where: { id: actor.tenantId } }) : null;

  const base = {
    firstName: actor.firstName,
    lastName: actor.lastName,
    email: actor.email,
    phone: actor.phone,
    role: actor.role,
    tenantName: tenant?.name ?? null,
  };

  if (actor.role === UserRole.TEACHER) {
    const teacherProfile = await withTenantContext(actor, (tx) => tx.teacherProfile.findUnique({ where: { userId: actor.id } }));
    return NextResponse.json({ ...base, branch: teacherProfile?.branch ?? null, title: teacherProfile?.title ?? null });
  }

  if (actor.role === UserRole.STUDENT) {
    const studentProfile = await withTenantContext(actor, (tx) =>
      tx.studentProfile.findUnique({
        where: { userId: actor.id },
        include: { classroom: true, guardians: { include: { parent: { include: { user: true } } } } },
      }),
    );
    const guardianRow = studentProfile?.guardians.find((g) => g.isBillingResponsible) ?? studentProfile?.guardians[0];
    return NextResponse.json({
      ...base,
      studentNo: studentProfile?.studentNo ?? null,
      gradeLevel: studentProfile?.gradeLevel ?? null,
      classroomName: studentProfile?.classroom?.name ?? null,
      targetGoal: studentProfile?.targetGoal ?? null,
      guardianName: guardianRow ? `${guardianRow.parent.user.firstName} ${guardianRow.parent.user.lastName}` : null,
      guardianPhone: guardianRow?.parent.user.phone ?? null,
      guardianRelation: guardianRow?.relation ?? null,
    });
  }

  if (actor.role === UserRole.PARENT) {
    const guardianRows = await withTenantContext(actor, (tx) =>
      tx.studentGuardian.findMany({
        where: { parent: { userId: actor.id } },
        include: { student: { include: { user: true, classroom: true } } },
      }),
    );
    return NextResponse.json({
      ...base,
      children: guardianRows.map((row) => ({
        studentId: row.studentId,
        fullName: `${row.student.user.firstName} ${row.student.user.lastName}`,
        studentNo: row.student.studentNo,
        gradeLevel: row.student.gradeLevel,
        classroomName: row.student.classroom?.name ?? null,
        relation: row.relation,
      })),
    });
  }

  const staffLikeRoles: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.GUIDANCE_COORDINATOR];
  if (staffLikeRoles.includes(actor.role)) {
    const staffProfile = await withTenantContext(actor, (tx) => tx.staffProfile.findUnique({ where: { userId: actor.id } }));
    return NextResponse.json({ ...base, title: staffProfile?.title ?? null, department: staffProfile?.department ?? null });
  }

  return NextResponse.json(base);
}
