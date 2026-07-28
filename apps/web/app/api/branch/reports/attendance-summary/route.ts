import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { toCsv } from "@/lib/csv";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Devamsızlık Özeti" CSV kartı — sınıf bazlı, gerçek `AttendanceRecord`
 * verisinden: öğrenci sayısı, yoklama alınan gün sayısı (distinct tarih) ve
 * devamsızlık oranı (`YOK` kayıtlarının tüm kayıtlara oranı).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol bu raporu indiremez" }, { status: 403 });
  }

  const csv = await withTenantContext(actor, async (tx) => {
    const classrooms = await tx.classroom.findMany({
      include: { students: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });

    const rows = classrooms.map((c) => {
      const daysTaken = new Set(c.attendanceRecords.map((r) => r.date.toISOString().slice(0, 10))).size;
      const total = c.attendanceRecords.length;
      const absent = c.attendanceRecords.filter((r) => r.status === AttendanceStatus.YOK).length;
      const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
      return [c.name, c.gradeLevel, c.students.length, daysTaken, `%${absentRate}`];
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Rapor indirildi",
      detail: "Devamsızlık Özeti (CSV)",
    });

    return toCsv(["Sınıf", "Sınıf Düzeyi", "Öğrenci Sayısı", "Alınan Gün Sayısı", "Devamsızlık Oranı"], rows);
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="devamsizlik_ozeti.csv"',
    },
  });
}
