import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Velinin giriş "kullanıcı adı"nı (User.email) değiştirir — bkz.
 * ../../students/[studentId]/route.ts'deki aynı yorumun genel gerekçesi.
 * `ParentProfile` RLS taşımadığından, en az bir StudentGuardian bağlantısının
 * bu tenant'taki bir öğrenciye ait olduğu açıkça doğrulanır.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function PATCH(request: NextRequest, { params }: { params: { parentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol veli kullanıcı adını değiştiremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username || !username.includes("@")) {
    return NextResponse.json({ message: "Geçerli bir kullanıcı adı (e-posta) zorunludur" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
      const guardianLink = await tx.studentGuardian.findFirst({
        where: { parentId: params.parentId, student: { tenantId: effectiveTenantId(actor) } },
        include: { parent: { include: { user: true } } },
      });
      if (!guardianLink) return { kind: "not_found" as const };

      const updatedUser = await tx.user.update({ where: { id: guardianLink.parent.userId }, data: { email: username } });
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "Veli kullanıcı adı değiştirildi",
        detail: `${guardianLink.parent.user.firstName} ${guardianLink.parent.user.lastName} → ${username}`,
      });
      return { kind: "updated" as const, username: updatedUser.email };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu kullanıcı adı zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Veli bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ username: outcome.username });
}
