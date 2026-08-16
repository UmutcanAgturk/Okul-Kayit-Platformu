import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { CLASSROOM_ELIGIBLE_GRADE_LEVELS, gradeClassroomPrefix } from "@/lib/grade-tier";

/**
 * Yoklama (Devamsızlık) ekranındaki sınıf seçicisini doldurur — öğretmenin
 * hangi sınıflara yoklama alabileceğini belirlemek için (bkz. app/api/branch/attendance).
 * Sınıf Atama — demo/seviye360-app.html'deki "branch:assign" ekranının şube
 * oluşturma tarafının gerçek karşılığı (bkz. GRADE_TIER.ts gradeClassroomPrefix).
 */
const READ_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const MANAGE_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!READ_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf listesini görüntüleyemez" }, { status: 403 });
  }

  const classrooms = await withBranchTenantContext(actor, (tx) =>
    tx.classroom.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
  );

  return NextResponse.json({
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      capacity: c.capacity,
      studentCount: c._count.students,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol sınıf oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const gradeLevel = typeof body.gradeLevel === "string" ? (body.gradeLevel as GradeLevel) : null;
  const suffix = typeof body.suffix === "string" ? body.suffix.trim().toUpperCase().slice(0, 3) : "";
  const capacity = Number.isFinite(Number(body.capacity)) && Number(body.capacity) > 0 ? Math.floor(Number(body.capacity)) : 30;

  if (!gradeLevel || !CLASSROOM_ELIGIBLE_GRADE_LEVELS.includes(gradeLevel)) {
    return NextResponse.json({ message: "Geçersiz sınıf düzeyi" }, { status: 400 });
  }
  if (!suffix) {
    return NextResponse.json({ message: "Şube adı zorunludur" }, { status: 400 });
  }
  const prefix = gradeClassroomPrefix(gradeLevel);
  if (!prefix) {
    return NextResponse.json({ message: "Bu sınıf düzeyi için şube açılamaz" }, { status: 400 });
  }
  const name = `${prefix}-${suffix}`;

  try {
    const classroom = await withBranchTenantContext(actor, (tx) =>
      tx.classroom.create({ data: { tenantId: effectiveTenantId(actor), name, gradeLevel, capacity } }),
    );
    return NextResponse.json(
      { classroom: { id: classroom.id, name: classroom.name, gradeLevel: classroom.gradeLevel, capacity: classroom.capacity, studentCount: 0 } },
      { status: 201 },
    );
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu şube kodu zaten var" }, { status: 409 });
    }
    throw e;
  }
}
