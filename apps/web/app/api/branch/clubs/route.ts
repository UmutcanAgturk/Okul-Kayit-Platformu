import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Kulüpler / Sosyal Etkinlikler — demo'daki "branch:kulup" ekranının
 * karşılığı. `Club` yalnızca düz `tenant_isolation` taşır (bkz.
 * prisma/schema.prisma) — Devamsızlık/Disiplin/PTA ile aynı desen.
 * Yalnızca BRANCH_ADMIN yeni kulüp oluşturabilir; danışman ataması
 * `TeacherProfile` üzerinden yapılır (bkz. app/api/branch/teachers).
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.BRANCH_ADMIN && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Yalnızca şube yöneticisi kulüpleri listeleyebilir" }, { status: 403 });
  }

  const clubs = await withBranchTenantContext(actor, (tx) =>
    tx.club.findMany({
      include: { advisorTeacher: { include: { user: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    }),
  );

  return NextResponse.json({
    clubs: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      advisorTeacherId: c.advisorTeacherId,
      advisorName: c.advisorTeacher ? `${c.advisorTeacher.user.firstName} ${c.advisorTeacher.user.lastName}` : null,
      memberCount: c._count.members,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.BRANCH_ADMIN && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Yalnızca şube yöneticisi kulüp oluşturabilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const advisorTeacherId = typeof body.advisorTeacherId === "string" && body.advisorTeacherId ? body.advisorTeacherId : null;

  if (!name) {
    return NextResponse.json({ message: "name zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    if (advisorTeacherId) {
      // TeacherProfile'da tenantId kolonu yok — bkz. app/api/branch/teachers
      // route'undaki not. Aynı desenle User.tenantId üzerinden doğrulanır.
      const teacher = await tx.teacherProfile.findFirst({
        where: { id: advisorTeacherId, user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER } },
      });
      if (!teacher) return { kind: "teacher_not_found" as const };
    }
    const club = await tx.club.create({
      data: { tenantId: effectiveTenantId(actor), name, description, advisorTeacherId },
    });
    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kulüp oluşturuldu",
      detail: name,
    });
    return { kind: "created" as const, club };
  });

  if (outcome.kind === "teacher_not_found") {
    return NextResponse.json({ message: "Danışman öğretmen bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ club: outcome.club }, { status: 201 });
}
