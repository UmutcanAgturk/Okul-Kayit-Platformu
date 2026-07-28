import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * Karne — demo/seviye360-app.html'deki buildKarneHtml()'in gerçek karşılığı.
 * Demo'daki yorumla aynı prensip: yeni bir veri modeli EKLENMEZ, zaten var
 * olan iki gerçek modülün (Ölçme-Değerlendirme'nin ExamResult/
 * StudentAchievementResult'ı ve Devamsızlık'ın AttendanceRecord'u — bkz.
 * app/api/students/[studentId]/attendance) verisi tek bir yanıtta birleşir.
 * Yetki kontrolü Devamsızlık ile birebir aynıdır (bkz. o route'taki not).
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
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

    const examResults = await tx.examResult.findMany({
      where: { studentId: student.id },
      include: { exam: true, achievementResults: { include: { achievement: true } } },
      orderBy: { exam: { examDate: "desc" } },
    });

    const examHistory = examResults.map((r) => ({
      examId: r.examId,
      examName: r.exam.name,
      examType: r.exam.type,
      examDate: r.exam.examDate.toISOString().slice(0, 10),
      netScore: r.netScore,
      rawScore: r.rawScore,
      percentile: r.percentile,
    }));

    const ratiosBySubject = new Map<string, number[]>();
    for (const r of examResults) {
      for (const a of r.achievementResults) {
        const subject = subjectFromCode(a.achievement.code);
        if (!ratiosBySubject.has(subject)) ratiosBySubject.set(subject, []);
        ratiosBySubject.get(subject)!.push(a.correctRatio);
      }
    }
    const subjectBreakdown = Array.from(ratiosBySubject.entries())
      .map(([subject, ratios]) => ({
        subject,
        achievementCount: ratios.length,
        avgMasteryPct: Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, "tr"));

    const attendanceRecords = await tx.attendanceRecord.findMany({ where: { studentId: student.id } });
    const total = attendanceRecords.length;
    const countByStatus = (status: AttendanceStatus) => attendanceRecords.filter((r) => r.status === status).length;
    const absentDays = countByStatus(AttendanceStatus.YOK);

    return {
      kind: "ok" as const,
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      examHistory,
      subjectBreakdown,
      attendanceSummary: {
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
    return NextResponse.json({ message: "Bu öğrencinin karnesini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json(result);
}
