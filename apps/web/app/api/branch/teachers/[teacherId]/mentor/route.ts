import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Seviye Mentör mentör havuzu yönetimi — demo'da "Mentör Öğretmen" ayrı bir
 * personel rolüdür (CURRENT_BRANCH.staff), burada ise mevcut bir öğretmenin
 * (`TeacherProfile.isMentor`) ek bir görevi olarak modellenir (bkz. şemadaki
 * not). Yalnızca BRANCH_ADMIN açıp kapatabilir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function POST(request: NextRequest, { params }: { params: { teacherId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol mentör atamasını değiştiremez" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const teacher = await tx.teacherProfile.findFirst({
      where: { id: params.teacherId, user: { tenantId: actor.tenantId!, role: UserRole.TEACHER } },
      include: { user: true },
    });
    if (!teacher) return null;

    const updated = await tx.teacherProfile.update({
      where: { id: teacher.id },
      data: { isMentor: !teacher.isMentor },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: updated.isMentor ? "Mentör havuzuna eklendi" : "Mentör havuzundan çıkarıldı",
      detail: `${teacher.user.firstName} ${teacher.user.lastName}`,
    });

    return updated;
  });

  if (!result) {
    return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ isMentor: result.isMentor });
}
