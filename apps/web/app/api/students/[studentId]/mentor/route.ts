import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

function mentorMonthlyQuota(gradeLevel: GradeLevel) {
  return gradeLevel === GradeLevel.SINIF_8 || gradeLevel === GradeLevel.SINIF_12 || gradeLevel === GradeLevel.MEZUN ? 2 : 1;
}

/**
 * Seviye Mentör — bir öğrencinin mentör atamasını ve aylık kotasını döner.
 * Demo'daki `ensureMentorAssignment()` gibi, mentör havuzu (isMentor=true
 * TeacherProfile) varsa ve öğrencinin henüz ataması yoksa BU GET SIRASINDA
 * round-robin (en az mentisi olan mentöre) otomatik atama yapar — bilinçli
 * bir yan etki, demo'daki "öğrenci ekranını ilk açtığında otomatik atanır"
 * davranışını birebir yansıtır.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    let mentorTeacherId = student.mentorTeacherId;
    if (!mentorTeacherId) {
      const mentors = await tx.teacherProfile.findMany({
        where: { isMentor: true, user: { tenantId: actor.tenantId!, role: UserRole.TEACHER } },
        include: { _count: { select: { mentees: true } } },
      });
      if (mentors.length > 0) {
        const chosen = mentors.reduce((best, m) => (m._count.mentees < best._count.mentees ? m : best), mentors[0]);
        const updated = await tx.studentProfile.update({ where: { id: student.id }, data: { mentorTeacherId: chosen.id } });
        mentorTeacherId = updated.mentorTeacherId;
      }
    }

    if (!mentorTeacherId) {
      return { kind: "ok" as const, mentor: null, quota: null };
    }

    const mentor = await tx.teacherProfile.findUnique({ where: { id: mentorTeacherId }, include: { user: true } });

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const used = await tx.mentorRequest.count({
      where: {
        studentId: student.id,
        status: { not: "REDDEDILDI" },
        createdAt: { gte: monthStart },
      },
    });
    const limit = mentorMonthlyQuota(student.gradeLevel);

    return {
      kind: "ok" as const,
      mentor: mentor ? { id: mentor.id, name: `${mentor.user.firstName} ${mentor.user.lastName}`, branch: mentor.branch } : null,
      quota: { used, limit },
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin mentör bilgisini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json({ mentor: result.mentor, quota: result.quota });
}
