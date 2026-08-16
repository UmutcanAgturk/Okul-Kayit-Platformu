import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Roller > Öğrenciler sekmesi — demo'daki roller ekranının "Öğrenciler"
 * tab'ının gerçek karşılığı. Öğrencinin kendi User.email'i giriş "kullanıcı
 * adı"dır (bu depoda ayrı bir username alanı yok — bkz. [studentId]/route.ts
 * yorumu). Yalnızca BRANCH_ADMIN (Roller ekranının kendisi zaten öyle).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci kullanıcı adlarını görüntüleyemez" }, { status: 403 });
  }

  const students = await withBranchTenantContext(actor, async (tx) => {
    const rows = await tx.studentProfile.findMany({
      include: { user: true, classroom: true },
      orderBy: { user: { firstName: "asc" } },
    });
    return rows.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      studentNo: s.studentNo,
      classroomName: s.classroom?.name ?? null,
      username: s.user.email,
    }));
  });

  return NextResponse.json({ students });
}
