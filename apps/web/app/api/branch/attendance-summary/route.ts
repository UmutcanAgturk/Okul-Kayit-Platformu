import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Devamsızlık — şube geneli özet (demo'daki "branch:attendance" ekranının
 * karşılığı, `AttendanceDashboard`'daki tek-sınıf/tek-tarih yoklama alma
 * aracından ayrı). Sınıf bazlı kırılım `reports/attendance-summary`
 * (CSV export) rotasındakiyle AYNI hesaplamayı (öğrenci sayısı, alınan gün
 * sayısı, devamsızlık oranı) kullanır, buna ek olarak "bugün alındı mı"
 * bayrağını da hesaplar — CSV raporunda bu bilgi yok, demo'nun stat
 * kartlarından biri (`Bugün Yoklaması Alınan`) bunu gerektiriyor.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol devamsızlık özetini görüntüleyemez" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);

  const result = await withBranchTenantContext(actor, async (tx) => {
    const classrooms = await tx.classroom.findMany({
      include: { students: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });

    const rows = classrooms.map((c) => {
      const daysTaken = new Set(c.attendanceRecords.map((r) => r.date.toISOString().slice(0, 10))).size;
      const total = c.attendanceRecords.length;
      const absent = c.attendanceRecords.filter((r) => r.status === AttendanceStatus.YOK).length;
      const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
      const takenToday = c.attendanceRecords.some((r) => r.date.getTime() === todayStart.getTime());
      return {
        classroomId: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        studentCount: c.students.length,
        daysTaken,
        takenToday,
        absentRate,
      };
    });

    const classroomsTotal = rows.length;
    const takenTodayCount = rows.filter((r) => r.takenToday).length;
    const avgAbsentRate = classroomsTotal > 0 ? Math.round(rows.reduce((sum, r) => sum + r.absentRate, 0) / classroomsTotal) : 0;

    return { classrooms: rows, summary: { classroomsTotal, takenTodayCount, avgAbsentRate } };
  });

  return NextResponse.json(result);
}
