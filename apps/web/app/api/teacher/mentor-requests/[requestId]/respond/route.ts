import { NextRequest, NextResponse } from "next/server";
import { MentorRequestStatus, UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Bir mentör öğretmenin kendisine yöneltilen bir mentör randevu talebine
 * yanıt vermesini sağlar — PtaMeetingRequest respond route'undaki desenin
 * tekrarı, ancak demo'daki gibi bir COMPLETE kararı da eklenir: yalnızca
 * ONAYLANDI durumundaki bir randevu, gerçekleştikten sonra TAMAMLANDI olarak
 * işaretlenebilir (bkz. MentorRequestStatus'taki not).
 */
export async function POST(request: NextRequest, { params }: { params: { requestId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler mentör talebine yanıt verebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = ["APPROVE", "REJECT", "COMPLETE"].includes(body.decision) ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ message: 'decision "APPROVE", "REJECT" veya "COMPLETE" olmalıdır' }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return { kind: "not_found" as const };

    const mentorRequest = await tx.mentorRequest.findFirst({
      where: { id: params.requestId, mentorTeacherId: teacherProfile.id },
    });
    if (!mentorRequest) return { kind: "not_found" as const };

    const requiredCurrentStatus = decision === "COMPLETE" ? MentorRequestStatus.ONAYLANDI : MentorRequestStatus.BEKLIYOR;
    if (mentorRequest.status !== requiredCurrentStatus) {
      return { kind: "invalid_transition" as const, status: mentorRequest.status };
    }

    const newStatus =
      decision === "APPROVE" ? MentorRequestStatus.ONAYLANDI : decision === "REJECT" ? MentorRequestStatus.REDDEDILDI : MentorRequestStatus.TAMAMLANDI;
    const updateResult = await tx.mentorRequest.updateMany({
      where: { id: mentorRequest.id, status: requiredCurrentStatus },
      data: { status: newStatus },
    });
    if (updateResult.count === 0) {
      return { kind: "invalid_transition" as const, status: newStatus };
    }

    const updated = await tx.mentorRequest.findUniqueOrThrow({ where: { id: mentorRequest.id } });
    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action:
        decision === "APPROVE" ? "Mentör randevusu onaylandı" : decision === "REJECT" ? "Mentör randevusu reddedildi" : "Mentör randevusu tamamlandı",
    });
    return { kind: "responded" as const, request: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Mentör talebi bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "invalid_transition") {
    return NextResponse.json({ message: `Bu talep "${outcome.status}" durumunda — bu işlem uygulanamaz.` }, { status: 409 });
  }
  return NextResponse.json({ request: outcome.request }, { status: 200 });
}
