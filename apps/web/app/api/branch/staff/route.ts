import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateStaffEmail, generateTempPassword } from "@/lib/enrollment";

/**
 * Öğretmen dışı personel (StaffProfile) modülü — Bordro'nun (bkz.
 * app/api/branch/payroll) TeacherProfile'a ek olarak StaffProfile'ı da
 * hedefleyebilmesi için gereken CRUD. StaffProfile, TeacherProfile'ın aksine
 * kendi tenantId'sini taşıdığı için RLS burada tam koruma sağlar (bkz.
 * prisma/rls/README.md).
 *
 * Personelin bağlı olduğu User rolü, "title" alanına göre çağıran tarafından
 * seçilir (BRANCH_ADMIN/ACCOUNTING/GUIDANCE_COORDINATOR — TEACHER/STUDENT/
 * PARENT/SUPERADMIN burada oluşturulamaz).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
const STAFF_USER_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personel listesini görüntüleyemez" }, { status: 403 });
  }

  const staff = await withBranchTenantContext(actor, (tx) =>
    tx.staffProfile.findMany({
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      role: s.user.role,
      isActive: s.user.isActive,
      title: s.title,
      department: s.department,
      startDate: s.startDate,
      salary: s.salary,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personel oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : null;
  const role = typeof body.role === "string" && STAFF_USER_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  const department = typeof body.department === "string" && body.department.trim() ? body.department.trim() : null;
  const startDate = typeof body.startDate === "string" && !isNaN(Date.parse(body.startDate)) ? new Date(body.startDate) : null;
  const salary = typeof body.salary === "number" && body.salary > 0 ? body.salary : null;

  if (!fullName || !role || !title || !startDate || !salary) {
    return NextResponse.json(
      {
        message:
          "fullName, role (BRANCH_ADMIN/ACCOUNTING/GUIDANCE_COORDINATOR), title, startDate ve salary (>0) zorunludur",
      },
      { status: 400 },
    );
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: effectiveTenantId(actor) } });

    let email = generateStaffEmail(fullName, tenant.code);
    for (let attempt = 2; await tx.user.findUnique({ where: { email } }); attempt++) {
      const [local, domain] = email.split("@");
      email = `${local.replace(/\d+$/, "")}${attempt}@${domain}`;
      if (attempt > 20) throw new Error("Benzersiz e-posta üretilemedi");
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    const user = await tx.user.create({
      data: { tenantId: effectiveTenantId(actor), email, passwordHash, role, firstName, lastName },
    });

    const staff = await tx.staffProfile.create({
      data: { tenantId: effectiveTenantId(actor), userId: user.id, title, department, startDate, salary },
      include: { user: true },
    });

    return { staff, email, tempPassword };
  });

  return NextResponse.json(
    {
      staff: {
        id: outcome.staff.id,
        name: `${outcome.staff.user.firstName} ${outcome.staff.user.lastName}`,
        email: outcome.staff.user.email,
        role: outcome.staff.user.role,
        isActive: outcome.staff.user.isActive,
        title: outcome.staff.title,
        department: outcome.staff.department,
        startDate: outcome.staff.startDate,
        salary: outcome.staff.salary,
      },
      credentials: { username: outcome.email, password: outcome.tempPassword },
    },
    { status: 201 },
  );
}
