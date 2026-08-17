import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

// Personel'in (StaffProfile) PATCH/DELETE'iyle aynı yönetim yetkisi (bkz.
// app/api/branch/staff/[staffId]/route.ts).
const MANAGE_ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

/**
 * TeacherProfile'ın kendisi RLS ile tenant'a scope edilmemiştir (tabloda
 * doğrudan bir tenantId kolonu yok — bkz. app/api/branch/teachers/route.ts
 * yorumu) — bu yüzden her işlemden önce `teacher.user.tenantId ===
 * effectiveTenantId(actor)` uygulama katmanında elle doğrulanır (aynı desen
 * app/api/branch/payroll/route.ts'de de kullanılır).
 */
async function findOwnTeacher(
  tx: Prisma.TransactionClient | PrismaClient,
  teacherId: string,
  actor: Parameters<typeof effectiveTenantId>[0],
) {
  const teacher = await tx.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
  if (!teacher || teacher.user.tenantId !== effectiveTenantId(actor)) return null;
  return teacher;
}

/**
 * Profil düzenleme + kullanıcı adı (giriş e-postası) değişikliği tek PATCH'te
 * — Personel'in aksine Teacher'ın değiştirilebilir bir "role"ü yoktur (her
 * zaman TEACHER), bu yüzden Personel'deki ayrı yüksek-yetki bölünmesine
 * gerek yok; tüm alanlar aynı MANAGE_ROLES_ALLOWED ile korunur.
 */
export async function PATCH(request: NextRequest, { params }: { params: { teacherId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen profilini düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" && body.firstName.trim() ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" && body.lastName.trim() ? body.lastName.trim() : undefined;
  const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : undefined;
  const title = typeof body.title === "string" ? body.title.trim() || null : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
  const isMentor = typeof body.isMentor === "boolean" ? body.isMentor : undefined;
  const hasSalary = "salary" in body;
  const salary = hasSalary ? (typeof body.salary === "number" && body.salary > 0 ? body.salary : null) : undefined;
  const hasUsername = "username" in body;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (hasUsername && (!username || !username.includes("@"))) {
    return NextResponse.json({ message: "Geçerli bir kullanıcı adı (e-posta) zorunludur" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
      const teacher = await findOwnTeacher(tx, params.teacherId, actor);
      if (!teacher) return { kind: "not_found" as const };

      if (firstName !== undefined || lastName !== undefined || phone !== undefined || isActive !== undefined || hasUsername) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: { firstName, lastName, phone, isActive, ...(hasUsername ? { email: username } : {}) },
        });
      }
      if (branch !== undefined || title !== undefined || isMentor !== undefined || hasSalary) {
        await tx.teacherProfile.update({ where: { id: teacher.id }, data: { branch, title, isMentor, ...(hasSalary ? { salary } : {}) } });
      }
      if (hasUsername) {
        await logActivity(tx, {
          tenantId: effectiveTenantId(actor),
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Öğretmen kullanıcı adı değiştirildi",
          detail: `${teacher.user.firstName} ${teacher.user.lastName} → ${username}`,
        });
      }

      const updated = await tx.teacherProfile.findUniqueOrThrow({ where: { id: teacher.id }, include: { user: true } });
      return { kind: "updated" as const, teacher: updated };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      const target = "meta" in e && e.meta && typeof e.meta === "object" && "target" in e.meta ? String(e.meta.target) : "";
      if (target.includes("email")) {
        return NextResponse.json({ message: "Bu kullanıcı adı zaten kayıtlı" }, { status: 409 });
      }
      return NextResponse.json({ message: "Bu telefon numarası zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
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
  });
}

/**
 * Varsayılan: User.isActive'i false yapar (deaktive eder) — Personel'deki
 * aynı yaklaşım (bkz. app/api/branch/staff/[staffId]/route.ts DELETE notu).
 *
 * `?permanent=true`: yalnızca öğretmenin GERÇEK bir geçmişi/bağımlılığı
 * yoksa izin verilir. StaffProfile'ın aksine TeacherProfile'a bağlı FK'ler
 * çok daha fazladır ve çoğu CASCADE değildir (yalnızca
 * TeacherAvailabilitySlot cascade'dir) — bu yüzden tüm bağımlı ilişkiler
 * silmeden ÖNCE açıkça sayılır (bkz. task #74'teki öğrenci kalıcı silme
 * ile aynı desen).
 */
export async function DELETE(request: NextRequest, { params }: { params: { teacherId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmeni devre dışı bırakamaz" }, { status: 403 });
  }

  const permanent = request.nextUrl.searchParams.get("permanent") === "true";

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const teacher = await findOwnTeacher(tx, params.teacherId, actor);
    if (!teacher) return { kind: "not_found" as const };

    if (permanent) {
      const [mentees, timetableSlots, ptaMeetingRequests, advisedClubs, studySessions, payrollRecords, mentorRequests] = await Promise.all([
        tx.studentProfile.count({ where: { mentorTeacherId: teacher.id } }),
        tx.timetableSlot.count({ where: { teacherId: teacher.id } }),
        tx.ptaMeetingRequest.count({ where: { teacherId: teacher.id } }),
        tx.club.count({ where: { advisorTeacherId: teacher.id } }),
        tx.studySession.count({ where: { teacherId: teacher.id } }),
        tx.payrollRecord.count({ where: { teacherId: teacher.id } }),
        tx.mentorRequest.count({ where: { mentorTeacherId: teacher.id } }),
      ]);
      const totalHistory = mentees + timetableSlots + ptaMeetingRequests + advisedClubs + studySessions + payrollRecords + mentorRequests;
      if (totalHistory > 0) {
        return { kind: "has_history" as const };
      }
      await tx.teacherAvailabilitySlot.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherProfile.delete({ where: { id: teacher.id } });
      await tx.user.delete({ where: { id: teacher.userId } });
      return { kind: "deleted" as const };
    }
    await tx.user.update({ where: { id: teacher.userId }, data: { isActive: false } });
    return { kind: "deactivated" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "has_history") {
    return NextResponse.json(
      { message: "Bu öğretmenin ders programı/menti/bordro gibi geçmişi olduğu için kalıcı olarak silinemez — yalnızca devre dışı bırakılabilir." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
