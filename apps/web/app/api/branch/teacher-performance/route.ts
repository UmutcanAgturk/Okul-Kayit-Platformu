import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, tenantScopeFilter } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Öğretmen Performansı — demo/seviye360-app.html'deki "ogretmenperf" ekranının
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ: CurriculumNode/Exam'de
 * öğretmen-ders eşlemesi tutan bir alan yok (bkz. lib/curriculum.ts'teki
 * "CurriculumNode'da ayrı bir subject alanı yok" notu), bu yüzden performans
 * TeacherProfile.branch ("Matematik" gibi bir zümre adı) ile aynı zümredeki
 * TÜM StudentAchievementResult satırlarının ortalama correctRatio'sundan
 * hesaplanır — Global Analytics'teki subjectPerformance ile birebir aynı
 * ilke (bkz. app/api/hq/analytics), yalnızca tek bir tenant'a scope edilmiş
 * ve öğretmen bazında gruplanmış hali.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğretmen performansını görüntüleyemez" }, { status: 403 });
  }

  const teachers = await withBranchTenantContext(actor, async (tx) => {
    // DİKKAT: TeacherProfile'da da (StudentAchievementResult gibi) RLS yok —
    // tabloda doğrudan bir tenantId kolonu yok (bkz. app/api/branch/teachers'daki
    // aynı not). Tenant filtresi burada `User.tenantId` üzerinden AÇIKÇA uygulanır.
    const teacherProfiles = await tx.teacherProfile.findMany({
      where: { user: { ...tenantScopeFilter(actor), role: UserRole.TEACHER, isActive: true } },
      include: { user: true },
      orderBy: { user: { firstName: "asc" } },
    });

    // DİKKAT: StudentAchievementResult tablosunda RLS YOK (bkz. prisma/rls/README.md
    // — yalnızca ExamResult/StudentProfile gibi ilişkili tablolarda tenant_isolation
    // var). Bu yüzden tenant filtresi burada AÇIKÇA `student.tenantId` üzerinden
    // uygulanır — aksi halde bir BRANCH_ADMIN tüm şubelerin verisini görürdü.
    const achievementRows = await tx.studentAchievementResult.findMany({
      where: { student: { ...tenantScopeFilter(actor) } },
      include: { achievement: true },
    });

    const ratiosBySubject = new Map<string, number[]>();
    for (const row of achievementRows) {
      const subject = subjectFromCode(row.achievement.code);
      if (!ratiosBySubject.has(subject)) ratiosBySubject.set(subject, []);
      ratiosBySubject.get(subject)!.push(row.correctRatio);
    }

    // Sınıflar/Öğrenci/Devam/Davranış sütunları — demo'daki gibi öğretmenin
    // FİİLEN verdiği sınıfların (TimetableSlot.teacherId+classroomId, gerçek
    // bir Prisma ilişkisi) öğrenci kadrosundan hesaplanır. Bu, achievement
    // hesabındaki branş-adı eşleştirmesinden (yukarıda) farklı ve daha kesin
    // bir kaynak — TeacherProfile.branch'te doğrudan sınıf/öğrenci bağlantısı
    // yok, ama TimetableSlot'ta var.
    const slots = await tx.timetableSlot.findMany({ select: { teacherId: true, classroomId: true } });
    const classroomIdsByTeacher = new Map<string, Set<string>>();
    for (const s of slots) {
      if (!classroomIdsByTeacher.has(s.teacherId)) classroomIdsByTeacher.set(s.teacherId, new Set());
      classroomIdsByTeacher.get(s.teacherId)!.add(s.classroomId);
    }
    const allClassroomIds = [...new Set(slots.map((s) => s.classroomId))];

    const classrooms = allClassroomIds.length
      ? await tx.classroom.findMany({ where: { id: { in: allClassroomIds } }, select: { id: true, name: true } })
      : [];
    const classroomName = new Map(classrooms.map((c) => [c.id, c.name]));

    const students = allClassroomIds.length
      ? await tx.studentProfile.findMany({ where: { classroomId: { in: allClassroomIds } }, select: { id: true, classroomId: true } })
      : [];
    const studentIdsByClassroom = new Map<string, string[]>();
    for (const s of students) {
      if (!s.classroomId) continue;
      if (!studentIdsByClassroom.has(s.classroomId)) studentIdsByClassroom.set(s.classroomId, []);
      studentIdsByClassroom.get(s.classroomId)!.push(s.id);
    }
    const allStudentIds = students.map((s) => s.id);

    const attendanceRows = allStudentIds.length
      ? await tx.attendanceRecord.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, status: true } })
      : [];
    const attByStudent = new Map<string, { var: number; total: number }>();
    for (const a of attendanceRows) {
      const bucket = attByStudent.get(a.studentId) ?? { var: 0, total: 0 };
      bucket.total += 1;
      if (a.status === "VAR") bucket.var += 1;
      attByStudent.set(a.studentId, bucket);
    }

    const disciplineRows = allStudentIds.length
      ? await tx.disciplineRecord.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, type: true } })
      : [];
    const discByStudent = new Map<string, { olumlu: number; olumsuz: number }>();
    for (const d of disciplineRows) {
      const bucket = discByStudent.get(d.studentId) ?? { olumlu: 0, olumsuz: 0 };
      if (d.type === "OLUMLU") bucket.olumlu += 1;
      else bucket.olumsuz += 1;
      discByStudent.set(d.studentId, bucket);
    }

    return teacherProfiles.map((t) => {
      const ratios = ratiosBySubject.get(t.branch) ?? [];
      const avgMasteryPct = ratios.length > 0 ? Math.round((ratios.reduce((sum, r) => sum + r, 0) / ratios.length) * 100) : null;

      const classroomIds = [...(classroomIdsByTeacher.get(t.id) ?? [])];
      const rosterIds = [...new Set(classroomIds.flatMap((cId) => studentIdsByClassroom.get(cId) ?? []))];

      let varSum = 0;
      let totalSum = 0;
      let positiveCount = 0;
      let negativeCount = 0;
      for (const sId of rosterIds) {
        const att = attByStudent.get(sId);
        if (att) {
          varSum += att.var;
          totalSum += att.total;
        }
        const disc = discByStudent.get(sId);
        if (disc) {
          positiveCount += disc.olumlu;
          negativeCount += disc.olumsuz;
        }
      }
      const avgAttendancePct = totalSum > 0 ? Math.round((varSum / totalSum) * 100) : null;

      return {
        teacherId: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        branch: t.branch,
        title: t.title,
        resultCount: ratios.length,
        avgMasteryPct,
        classroomCodes: classroomIds.map((cId) => classroomName.get(cId) ?? cId),
        rosterSize: rosterIds.length,
        avgAttendancePct,
        positiveCount,
        negativeCount,
      };
    });
  });

  const attendanceValues = teachers.map((t) => t.avgAttendancePct).filter((v): v is number => v !== null);
  const summary = {
    totalTeachers: teachers.length,
    avgAttendancePct: attendanceValues.length > 0 ? Math.round(attendanceValues.reduce((sum, v) => sum + v, 0) / attendanceValues.length) : null,
    totalRoster: teachers.reduce((sum, t) => sum + t.rosterSize, 0),
  };

  return NextResponse.json({ teachers, summary });
}
