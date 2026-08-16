import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";

/**
 * Bir kulübün üye yönetimi için tam öğrenci listesi (roster) + üyelik
 * durumu. Yalnızca BRANCH_ADMIN veya o kulübün danışmanı olan TEACHER
 * görebilir — demo'daki "branch:kulup"/"teacher:kulup" ekranlarındaki
 * "Üyeleri Yönet" panelinin karşılığı.
 */
async function authorizeClubManage(tx: any, actor: { id: string; role: UserRole; actingTenantId?: string | null }, clubId: string) {
  const club = await tx.club.findUnique({ where: { id: clubId } });
  if (!club) return { kind: "not_found" as const };

  if (actor.role === UserRole.BRANCH_ADMIN) return { kind: "ok" as const, club };
  if (actor.role === UserRole.SUPERADMIN && actor.actingTenantId) return { kind: "ok" as const, club };
  if (actor.role === UserRole.TEACHER) {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (teacherProfile && club.advisorTeacherId === teacherProfile.id) return { kind: "ok" as const, club };
  }
  return { kind: "forbidden" as const };
}

export async function GET(request: NextRequest, { params }: { params: { clubId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  if (actor.role === UserRole.SUPERADMIN && !actor.actingTenantId) {
    return NextResponse.json({ message: "Bu işlem için önce Kurumlar sayfasından bir şube seçmelisiniz" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    const auth = await authorizeClubManage(tx, actor, params.clubId);
    if (auth.kind !== "ok") return auth;

    const [roster, memberships] = await Promise.all([
      tx.studentProfile.findMany({
        where: { tenantId: effectiveTenantId(actor) },
        include: { user: true, classroom: true },
        orderBy: { user: { firstName: "asc" } },
      }),
      tx.clubMembership.findMany({ where: { clubId: params.clubId } }),
    ]);
    const memberIds = new Set(memberships.map((m) => m.studentId));

    return {
      kind: "ok" as const,
      club: {
        id: auth.club.id,
        name: auth.club.name,
        description: auth.club.description,
        advisorTeacherId: auth.club.advisorTeacherId,
      },
      roster: roster.map((s) => ({
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        classroom: s.classroom?.name ?? null,
        isMember: memberIds.has(s.id),
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Kulüp bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu kulübü yönetme yetkiniz yok" }, { status: 403 });
  }
  return NextResponse.json(result);
}
