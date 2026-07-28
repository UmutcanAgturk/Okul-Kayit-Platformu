import { NextRequest, NextResponse } from "next/server";
import { DisciplineType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { DISCIPLINE_CATEGORIES, pointsForType } from "@/lib/discipline";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Disiplin/Davranış Takibi — demo/seviye360-app.html'deki "teacher:disiplin"/
 * "branch:disiplin" ekranlarının gerçek karşılığı. `DisciplineRecord`
 * yalnızca düz `tenant_isolation` taşır (bkz. prisma/schema.prisma) —
 * Devamsızlık ile aynı desen (bkz. o modüldeki not).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.TEACHER, UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const TYPES: DisciplineType[] = [DisciplineType.OLUMLU, DisciplineType.OLUMSUZ];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol disiplin kayıtlarını görüntüleyemez" }, { status: 403 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId");

  const records = await withTenantContext(actor, (tx) =>
    tx.disciplineRecord.findMany({
      where: studentId ? { studentId } : undefined,
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      type: r.type,
      category: r.category,
      note: r.note,
      points: r.points,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol disiplin kaydı ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  const type = typeof body.type === "string" && TYPES.includes(body.type as DisciplineType) ? (body.type as DisciplineType) : null;
  const category = typeof body.category === "string" && body.category ? body.category : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!studentId || !type || !category) {
    return NextResponse.json({ message: "studentId, type (OLUMLU/OLUMSUZ) ve category zorunludur" }, { status: 400 });
  }
  if (!DISCIPLINE_CATEGORIES[type].includes(category)) {
    return NextResponse.json(
      { message: `Geçersiz kategori. ${type} türü için geçerli kategoriler: ${DISCIPLINE_CATEGORIES[type].join(", ")}` },
      { status: 400 },
    );
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    // StudentProfile RLS ile tenant'a scope edilmiştir — başka bir tenant'a
    // ait bir id burada zaten görünmez (null döner).
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) return { kind: "not_found" as const };

    const record = await tx.disciplineRecord.create({
      data: {
        tenantId: actor.tenantId!,
        studentId,
        type,
        category,
        note,
        points: pointsForType(type),
        recordedByUserId: actor.id,
      },
    });
    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Disiplin kaydı eklendi",
      detail: `${type} · ${category}`,
    });
    return { kind: "created" as const, record };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ record: outcome.record }, { status: 201 });
}
