import { NextRequest, NextResponse } from "next/server";
import { MentorRequestStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, tenantScopeFilter } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { mentorMonthlyQuota } from "@/lib/mentor";

/**
 * Seviye Mentör — Şube Yöneticisi Öğrenci Atamaları — demo'daki
 * `renderMentorAdminBody()`'nin "Mentör Öğretmenler" + "Öğrenci Atamaları"
 * bölümlerinin karşılığı. `branch/mentor-requests` (randevu talepleri) ve
 * `branch/teachers/[teacherId]/mentor` (havuz aç/kapa) zaten ayrı uçlarda —
 * burada YALNIZCA roster/özet (GET) ve toplu otomatik atama (POST) eklenir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const AUTO_ASSIGN_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol mentör atamalarını görüntüleyemez" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    const [mentors, students, pendingRequestCount] = await Promise.all([
      // TeacherProfile'ın kendi RLS'i YOK (tenantId sütunu yok, bkz. branch/payroll
      // route'undaki not) — bu yüzden tenant filtresi `user` ilişkisi üzerinden
      // AÇIKÇA uygulanmalı; aksi halde başka şubelerin mentörleri de sızabilir.
      tx.teacherProfile.findMany({
        where: { isMentor: true, user: { ...tenantScopeFilter(actor), role: UserRole.TEACHER } },
        include: { user: true, _count: { select: { mentees: true } } },
      }),
      tx.studentProfile.findMany({
        where: { user: { isActive: true } },
        include: { user: true, classroom: true, mentorTeacher: { include: { user: true } } },
        orderBy: { user: { firstName: "asc" } },
      }),
      tx.mentorRequest.count({ where: { status: MentorRequestStatus.BEKLIYOR } }),
    ]);

    return { mentors, students, pendingRequestCount };
  });

  const unassignedCount = result.students.filter((s) => !s.mentorTeacherId).length;

  return NextResponse.json({
    summary: {
      mentorCount: result.mentors.length,
      unassignedCount,
      pendingRequestCount: result.pendingRequestCount,
    },
    mentors: result.mentors.map((m) => ({
      id: m.id,
      name: `${m.user.firstName} ${m.user.lastName}`,
      menteeCount: m._count.mentees,
    })),
    students: result.students.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      gradeLevel: s.gradeLevel,
      classroomName: s.classroom?.name ?? null,
      mentorTeacherId: s.mentorTeacherId,
      mentorName: s.mentorTeacher ? `${s.mentorTeacher.user.firstName} ${s.mentorTeacher.user.lastName}` : null,
      quotaLimit: mentorMonthlyQuota(s.gradeLevel),
    })),
  });
}

/**
 * Toplu otomatik atama — demo'daki `runAutoAssignMentors()` ile birebir aynı
 * round-robin: mentörsüz her öğrenci, o an en az mentisi olan mentöre atanır
 * (atandıkça sayaç artırılır, böylece aynı istek içinde dengeli dağılır).
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!AUTO_ASSIGN_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol otomatik atama yapamaz" }, { status: 403 });
  }

  const assignedCount = await withBranchTenantContext(actor, async (tx) => {
    const mentors = await tx.teacherProfile.findMany({
      where: { isMentor: true, user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER } },
      include: { _count: { select: { mentees: true } } },
    });
    if (mentors.length === 0) return 0;

    const counts = new Map(mentors.map((m) => [m.id, m._count.mentees]));
    const unassigned = await tx.studentProfile.findMany({
      where: { mentorTeacherId: null, user: { isActive: true } },
      select: { id: true },
    });

    let assigned = 0;
    for (const student of unassigned) {
      let chosenId = mentors[0].id;
      let chosenCount = counts.get(chosenId)!;
      for (const m of mentors) {
        const c = counts.get(m.id)!;
        if (c < chosenCount) {
          chosenId = m.id;
          chosenCount = c;
        }
      }
      await tx.studentProfile.update({ where: { id: student.id }, data: { mentorTeacherId: chosenId } });
      counts.set(chosenId, chosenCount + 1);
      assigned += 1;
    }

    if (assigned > 0) {
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "Mentörler otomatik atandı",
        detail: `${assigned} öğrenci`,
      });
    }

    return assigned;
  });

  return NextResponse.json({ assignedCount });
}
