import { NextRequest, NextResponse } from "next/server";
import { StudySessionStatus, UserRole } from "@prisma/client";
import { withTenantContext } from "@/lib/db-context";
import { getSessionActor } from "@/lib/session";

/**
 * Bir öğretmenin, önerilen (AI_SUGGESTED) bir etüt seansını onaylamasını/
 * reddetmesini VEYA daha önce onayladığı (TEACHER_APPROVED) bir seansı
 * gerçekleştikten sonra tamamlandı (COMPLETE) olarak işaretlemesini sağlar
 * — taksit tahsilatı API'sinde kurulan
 * deseni (gerçek Postgres + RLS + oturum tabanlı kimlik) ikinci bir alana,
 * StudySession modeline, tekrarlar (bkz. demo/seviye360/PRISMA-UZLASMA.md
 * madde "Etüt (StudySession)").
 *
 * Güvenlik: yalnızca TEACHER rolündeki, oturumdaki kullanıcı yanıt verebilir
 * ve yalnızca KENDİSİNE atanmış (`teacherId`) bir seansa — bu ikisi de sorgu
 * koşuluna eklenir. RLS ayrıca tenant izolasyonunu veritabanı seviyesinde
 * garanti eder: başka bir tenant'ın seansı zaten hiç görünmez.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Yalnızca öğretmenler etüt seansına yanıt verebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision =
    body.decision === "APPROVE" || body.decision === "REJECT" || body.decision === "COMPLETE" ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ message: "decision \"APPROVE\", \"REJECT\" veya \"COMPLETE\" olmalıdır" }, { status: 400 });
  }

  // COMPLETE, onaylanmış bir seansı tamamlandı olarak işaretler (demo'nun
  // "teacher:etut" ekranındaki tamamlama akışı) — APPROVE/REJECT'ten farklı
  // bir öncül durum (TEACHER_APPROVED) gerektirir.
  const requiredStatus = decision === "COMPLETE" ? StudySessionStatus.TEACHER_APPROVED : StudySessionStatus.AI_SUGGESTED;
  const newStatus =
    decision === "APPROVE"
      ? StudySessionStatus.TEACHER_APPROVED
      : decision === "REJECT"
        ? StudySessionStatus.TEACHER_REJECTED
        : StudySessionStatus.COMPLETED;

  const outcome = await withTenantContext(actor, async (tx) => {
    const teacherProfile = await tx.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!teacherProfile) return { kind: "not_found" as const };

    const session = await tx.studySession.findFirst({
      where: { id: params.sessionId, teacherId: teacherProfile.id },
    });
    if (!session) return { kind: "not_found" as const };

    if (session.status !== requiredStatus) {
      return { kind: "already_responded" as const, status: session.status };
    }

    const updateResult = await tx.studySession.updateMany({
      where: { id: session.id, status: requiredStatus },
      data: { status: newStatus },
    });
    if (updateResult.count === 0) {
      return { kind: "already_responded" as const, status: newStatus };
    }

    const updated = await tx.studySession.findUniqueOrThrow({ where: { id: session.id } });
    return { kind: "responded" as const, session: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Etüt seansı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_responded") {
    return NextResponse.json(
      { message: `Bu seans zaten "${outcome.status}" durumunda — tekrar yanıtlanamaz.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ session: outcome.session }, { status: 200 });
}
