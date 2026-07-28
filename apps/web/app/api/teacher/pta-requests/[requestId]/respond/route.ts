import { NextRequest, NextResponse } from "next/server";
import { PtaRequestStatus, UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

/**
 * Bir öğretmenin, kendisine yöneltilen bir Veli-Öğretmen Görüşme talebini
 * onaylamasını/reddetmesini sağlar — Etüt (StudySession) onay/red route'undaki
 * (app/api/teacher/study-sessions/[sessionId]/respond) desenin birebir
 * tekrarı: yalnızca TEACHER, yalnızca KENDİSİNE atanmış bir talep, ve yalnızca
 * hâlâ BEKLIYOR durumundaysa (aksi halde 409 — zaten karar verilmiş).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler görüşme talebine yanıt verebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = body.decision === "APPROVE" || body.decision === "REJECT" ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ message: "decision \"APPROVE\" veya \"REJECT\" olmalıdır" }, { status: 400 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return { kind: "not_found" as const };

    const ptaRequest = await tx.ptaMeetingRequest.findFirst({
      where: { id: params.requestId, teacherId: teacherProfile.id },
    });
    if (!ptaRequest) return { kind: "not_found" as const };

    if (ptaRequest.status !== PtaRequestStatus.BEKLIYOR) {
      return { kind: "already_responded" as const, status: ptaRequest.status };
    }

    const newStatus = decision === "APPROVE" ? PtaRequestStatus.ONAYLANDI : PtaRequestStatus.REDDEDILDI;
    const updateResult = await tx.ptaMeetingRequest.updateMany({
      where: { id: ptaRequest.id, status: PtaRequestStatus.BEKLIYOR },
      data: { status: newStatus },
    });
    if (updateResult.count === 0) {
      return { kind: "already_responded" as const, status: newStatus };
    }

    const updated = await tx.ptaMeetingRequest.findUniqueOrThrow({ where: { id: ptaRequest.id } });
    return { kind: "responded" as const, request: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Görüşme talebi bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_responded") {
    return NextResponse.json(
      { message: `Bu talep zaten "${outcome.status}" durumunda — tekrar yanıtlanamaz.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ request: outcome.request }, { status: 200 });
}
