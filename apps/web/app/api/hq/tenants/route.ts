import { NextRequest, NextResponse } from "next/server";
import { TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateBranchAdminEmail, generateTempPassword, generateTenantCode } from "@/lib/enrollment";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Kurum Yönetimi" (hq:kurumlar) — GET: tüm kurumların gerçek Postgres
 * verisinden anlık öğrenci/öğretmen/personel/sınıf sayıları ve şube müdürü
 * bilgisi (salt okunur envanter). POST: yeni bir kurum (SUBE) + otomatik
 * oluşturulan bir Şube Yöneticisi hesabı — demo'daki "Yeni Kurum Ekle"
 * formunun gerçek karşılığı, Normal Kayıt tamamlama route'undaki
 * (app/api/branch/enrollments/[id]/complete) "otomatik kullanıcı adı/şifre"
 * desenini tekrarlar. `withTenantContext` SUPERADMIN için `superadmin_role`
 * (BYPASSRLS) bağlantısına geçtiğinden tüm tenant'lar tek sorguda görülebilir
 * (bkz. lib/db-context.ts ve app/api/hq/accounting-ledger/route.ts'teki not).
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
      tx.user.findMany({
        where: { role: UserRole.BRANCH_ADMIN },
        select: { id: true, tenantId: true, firstName: true, lastName: true, phone: true },
      }),
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
    const branchAdminByTenant = new Map(
      branchAdmins
        .filter((u) => u.tenantId)
        .map((u) => [u.tenantId as string, { name: `${u.firstName} ${u.lastName}`, phone: u.phone }]),
    );

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      type: t.type,
      city: t.city,
      district: t.district,
      address: t.address,
      phone: t.phone,
      email: t.email,
      capacity: t.capacity,
      taxNo: t.taxNo,
      kurumTuru: t.kurumTuru,
      openingDate: t.openingDate,
      isActive: t.isActive,
      studentCount: studentCounts.get(t.id) ?? 0,
      classroomCount: classroomCounts.get(t.id) ?? 0,
      staffCount: staffCounts.get(t.id) ?? 0,
      teacherCount: teacherCounts.get(t.id) ?? 0,
      branchAdminName: branchAdminByTenant.get(t.id)?.name ?? null,
      branchAdminPhone: branchAdminByTenant.get(t.id)?.phone ?? null,
    }));
  });

  return NextResponse.json({ tenants: result });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez yeni kurum ekleyebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;
  const district = typeof body.district === "string" && body.district.trim() ? body.district.trim() : null;
  const managerFirstName = typeof body.managerFirstName === "string" && body.managerFirstName.trim() ? body.managerFirstName.trim() : null;
  const managerLastName = typeof body.managerLastName === "string" && body.managerLastName.trim() ? body.managerLastName.trim() : null;
  const address = typeof body.address === "string" && body.address.trim() ? body.address.trim() : null;
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const capacity = typeof body.capacity === "number" && body.capacity > 0 ? Math.round(body.capacity) : null;
  const taxNo = typeof body.taxNo === "string" && body.taxNo.trim() ? body.taxNo.trim() : null;
  const kurumTuru = typeof body.kurumTuru === "string" && body.kurumTuru.trim() ? body.kurumTuru.trim() : null;
  const openingDate = typeof body.openingDate === "string" && body.openingDate.trim() ? new Date(body.openingDate) : null;
  const managerPhone = typeof body.managerPhone === "string" && body.managerPhone.trim() ? body.managerPhone.trim() : null;

  if (!name || !city || !district || !managerFirstName || !managerLastName) {
    return NextResponse.json(
      { message: "name, city, district, managerFirstName ve managerLastName zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    let code = generateTenantCode(city, 1);
    for (let attempt = 2; await tx.tenant.findUnique({ where: { code } }); attempt++) {
      code = generateTenantCode(city, attempt);
      if (attempt > 50) throw new Error("Benzersiz kurum kodu üretilemedi");
    }

    const tenant = await tx.tenant.create({
      data: { name, code, type: TenantType.SUBE, city, district, address, phone, email, capacity, taxNo, kurumTuru, openingDate },
    });

    const managerFullName = `${managerFirstName} ${managerLastName}`;
    let managerEmail = generateBranchAdminEmail(managerFullName, tenant.code);
    for (let attempt = 2; await tx.user.findUnique({ where: { email: managerEmail } }); attempt++) {
      const [local, domain] = managerEmail.split("@");
      managerEmail = `${local.replace(/\d+$/, "")}${attempt}@${domain}`;
      if (attempt > 20) throw new Error("Benzersiz e-posta üretilemedi");
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: managerEmail,
        passwordHash,
        role: UserRole.BRANCH_ADMIN,
        firstName: managerFirstName,
        lastName: managerLastName,
        phone: managerPhone,
      },
    });

    await logActivity(tx, {
      tenantId: tenant.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Yeni kurum eklendi",
      detail: `${tenant.name} — ${city}/${district}`,
    });

    return { tenant, managerEmail, tempPassword };
  });

  return NextResponse.json(
    {
      tenant: outcome.tenant,
      credentials: { username: outcome.managerEmail, password: outcome.tempPassword },
    },
    { status: 201 },
  );
}
