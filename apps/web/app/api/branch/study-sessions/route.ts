import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Etüt — Şube Genel Bakışı. demo/seviye360-app.html'deki "branch:etut"
 * ekranının gerçek karşılığı: BRANCH_ADMIN/HQ'nun şubedeki TÜM etüt
 * taleplerini (öğretmenden bağımsız) görebilmesi. Öğretmenin kendi
 * seanslarını onaylama/reddetme/tamamlama akışı zaten
 * app/api/teacher/study-sessions(+/[id]/respond) ile GERÇEKti.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol etüt taleplerini görüntüleyemez" }, { status: 403 });
  }

  const sessions = await withBranchTenantContext(actor, (tx) =>
    tx.studySession.findMany({
      orderBy: { scheduledStart: "desc" },
      include: { achievement: true, teacher: { include: { user: true } }, student: { include: { user: true } } },
    }),
  );

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      source: s.source,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      teacherName: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
      studentName: `${s.student.user.firstName} ${s.student.user.lastName}`,
      achievement: s.achievement ? { code: s.achievement.code, label: s.achievement.label } : null,
      note: s.note,
    })),
  });
}
