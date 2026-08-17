import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateTeacherEmail, generateTempPassword } from "@/lib/enrollment";

// Öğretmen ekle/düzenle (task #88) — Personel (StaffProfile) modülüyle aynı
// yönetim yetkisi (bkz. app/api/branch/staff/route.ts ROLES_ALLOWED).
const MANAGE_ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

/**
 * Bordro formunun "hangi öğretmen için?" seçicisini doldurmak için — bordro
 * route'unun (bkz. app/api/branch/payroll/route.ts) kendi yorumunda dediği
 * gibi TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (tabloda
 * doğrudan bir tenantId kolonu yok), bu yüzden filtre burada `User.tenantId`
 * üzerinden uygulama katmanında yapılır — aynı deseni tekrarlar. PARENT de
 * dahil edilmiştir: Veli-Öğretmen Görüşme Randevusu formunda velinin
 * öğretmen seçebilmesi için kullanılır. STUDENT de dahildir: Etüt
 * Randevularım formunda öğrencinin kendi etüt talebi için öğretmen
 * seçebilmesi için kullanılır (bkz. app/api/students/[studentId]/study-sessions).
 */
// Opsiyonel ?subject= — demo'daki "ders bazlı öğretmen havuzu"nun karşılığı
// (bkz. task #57): Etüt talebi formunda önce bir ders seçilir, yalnızca o
// dersi veren (TeacherProfile.branch eşleşen) öğretmenler listelenir.
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING, UserRole.PARENT, UserRole.STUDENT];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen listesini görüntüleyemez" }, { status: 403 });
  }
  if (!actor.tenantId && !actor.actingTenantId) {
    return NextResponse.json({ teachers: [] });
  }

  const subject = request.nextUrl.searchParams.get("subject");
  // ?full=true — Personel ekranındaki Öğretmenler listesi için (task #88):
  // isActive filtresi olmadan (Pasif öğretmenler de dahil) ve daha zengin
  // alanlarla (e-posta/telefon/unvan/durum) döner. Bu parametre olmadan
  // davranış TAMAMEN aynı kalır — mevcut hiçbir çağıran (Bordro/PTA/Etüt
  // seçicileri) etkilenmez.
  const full = request.nextUrl.searchParams.get("full") === "true";

  const teachers = await withBranchTenantContext(actor, (tx) =>
    tx.teacherProfile.findMany({
      where: {
        user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER, ...(full ? {} : { isActive: true }) },
        ...(subject ? { branch: subject } : {}),
      },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  if (full) {
    if (!MANAGE_ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
      return NextResponse.json({ message: "Bu rol öğretmen kadrosunu tam olarak görüntüleyemez" }, { status: 403 });
    }
    return NextResponse.json({
      teachers: teachers.map((t) => ({
        id: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        email: t.user.email,
        phone: t.user.phone,
        isActive: t.user.isActive,
        branch: t.branch,
        title: t.title,
        isMentor: t.isMentor,
        salary: t.salary,
      })),
    });
  }

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      branch: t.branch,
      isMentor: t.isMentor,
      salary: t.salary,
    })),
  });
}

/**
 * Yeni öğretmen ekler — Personel'in (StaffProfile) POST'uyla aynı desen
 * (bkz. app/api/branch/staff/route.ts): otomatik e-posta/şifre üretimi,
 * User(role:TEACHER) + TeacherProfile birlikte oluşturulur.
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : null;
  const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const customEmail = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  if (customEmail && !customEmail.includes("@")) {
    return NextResponse.json({ message: "Geçerli bir e-posta girin" }, { status: 400 });
  }
  const salary = typeof body.salary === "number" && body.salary > 0 ? body.salary : null;

  if (!fullName || !branch) {
    return NextResponse.json({ message: "fullName ve branch (branş/zümre) zorunludur" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: effectiveTenantId(actor) } });

      let email = customEmail;
      if (!email) {
        email = generateTeacherEmail(fullName, tenant.code);
        for (let attempt = 2; await tx.user.findUnique({ where: { email } }); attempt++) {
          const [local, domain] = email.split("@");
          email = `${local.replace(/\d+$/, "")}${attempt}@${domain}`;
          if (attempt > 20) throw new Error("Benzersiz e-posta üretilemedi");
        }
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const [firstName, ...rest] = fullName.split(/\s+/);
      const lastName = rest.join(" ") || firstName;

      const user = await tx.user.create({
        data: { tenantId: effectiveTenantId(actor), email, passwordHash, role: UserRole.TEACHER, firstName, lastName, phone },
      });

      const teacher = await tx.teacherProfile.create({
        data: { userId: user.id, branch, title, salary: salary ?? undefined },
        include: { user: true },
      });

      return { teacher, email, tempPassword };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      const target = "meta" in e && e.meta && typeof e.meta === "object" && "target" in e.meta ? String(e.meta.target) : "";
      if (target.includes("email")) {
        return NextResponse.json({ message: "Bu e-posta zaten kayıtlı" }, { status: 409 });
      }
      return NextResponse.json({ message: "Bu telefon numarası zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json(
    {
      teacher: {
        id: outcome.teacher.id,
        name: `${outcome.teacher.user.firstName} ${outcome.teacher.user.lastName}`,
        email: outcome.teacher.user.email,
        phone: outcome.teacher.user.phone,
        isActive: outcome.teacher.user.isActive,
        branch: outcome.teacher.branch,
        title: outcome.teacher.title,
        isMentor: outcome.teacher.isMentor,
        salary: outcome.teacher.salary,
      },
      credentials: { username: outcome.email, password: outcome.tempPassword },
    },
    { status: 201 },
  );
}
