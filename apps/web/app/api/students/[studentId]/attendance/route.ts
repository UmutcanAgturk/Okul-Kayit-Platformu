import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Bir öğrencinin devamsızlık geçmişini döner. `/api/students/[studentId]/installments`'ın
 * (bkz. o route'taki not) aksine burada yetki KASITLI OLARAK "aynı tenant'taki
 * herhangi bir kullanıcı" ile sınırlı DEĞİL — STUDENT yalnızca kendi kaydını,
 * PARENT yalnızca velisi olduğu öğrencinin kaydını görebilir; personel
 * rolleri (TEACHER/BRANCH_ADMIN/GUIDANCE_COORDINATOR) ve SUPERADMIN her
 * öğrenciyi görebilir.
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

    const records = await tx.attendanceRecord.findMany({
      where: { studentId: student.id },
      orderBy: { date: "desc" },
    });

    const total = records.length;
    const countByStatus = (status: AttendanceStatus) => records.filter((r) => r.status === status).length;
    const absentDays = countByStatus(AttendanceStatus.YOK);

    return {
      kind: "ok" as const,
      studentId: student.id,
      records: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        note: r.note,
      })),
      summary: {
        totalDays: total,
        presentDays: countByStatus(AttendanceStatus.VAR),
        lateDays: countByStatus(AttendanceStatus.GEC),
        excusedDays: countByStatus(AttendanceStatus.IZINLI),
        absentDays,
        absenceRatePct: total > 0 ? Math.round((absentDays / total) * 100) : 0,
      },
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin devamsızlık kaydını görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
