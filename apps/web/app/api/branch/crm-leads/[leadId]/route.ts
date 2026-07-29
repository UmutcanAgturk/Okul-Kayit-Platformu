import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * PATCH: bir CRM adayının bilgilerini ve/veya aşamasını (stage) günceller.
 * Aşama "KAYIT_OLDU"ya taşındığında — demo'daki "Ön kayıt, CRM'de 'Kayıt
 * Oldu' statüsüne düşen adaylardan otomatik de oluşabilir" notuna uygun
 * olarak — otomatik bir Enrollment(ON_KAYIT) oluşturulur ve bu adaya bağlanır
 * (idempotent: zaten bir enrollmentId'si varsa tekrar oluşturulmaz).
 *
 * DELETE: adayı GERÇEKTEN siler (Enrollment'ın aksine) — bu aşamada henüz
 * finansal bir taahhüt yoktur (bkz. şemadaki not). Zaten bir Enrollment'a
 * dönüşmüş bir aday silinemez (409) — geçmiş/bağlantı korunur.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const VALID_STAGES = ["ARANDI", "GORUSULDU", "DENEME_SINAVINA_GIRDI", "KAYIT_OLDU"];

export async function PATCH(request: NextRequest, { params }: { params: { leadId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol CRM adayını düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const candidateFullName = typeof body.candidateFullName === "string" && body.candidateFullName.trim() ? body.candidateFullName.trim() : undefined;
  const candidateGradeLevel = typeof body.candidateGradeLevel === "string" && body.candidateGradeLevel in GradeLevel ? (body.candidateGradeLevel as GradeLevel) : undefined;
  const guardianFullName = typeof body.guardianFullName === "string" && body.guardianFullName.trim() ? body.guardianFullName.trim() : undefined;
  const guardianPhone = typeof body.guardianPhone === "string" && body.guardianPhone.trim() ? body.guardianPhone.trim() : undefined;
  const school = body.school === null ? null : typeof body.school === "string" && body.school.trim() ? body.school.trim() : undefined;
  const guardianEmail = body.guardianEmail === null ? null : typeof body.guardianEmail === "string" && body.guardianEmail.trim() ? body.guardianEmail.trim() : undefined;
  const notes = body.notes === null ? null : typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;
  const stage = typeof body.stage === "string" && VALID_STAGES.includes(body.stage) ? body.stage : undefined;

  const outcome = await withTenantContext(actor, async (tx) => {
    const lead = await tx.crmLead.findUnique({ where: { id: params.leadId } });
    if (!lead || lead.tenantId !== actor.tenantId) {
      return { kind: "not_found" as const };
    }

    let enrollmentId = lead.enrollmentId;
    if (stage === "KAYIT_OLDU" && !enrollmentId) {
      const enrollment = await tx.enrollment.create({
        data: {
          tenantId: actor.tenantId!,
          type: "ON_KAYIT",
          candidateFullName: candidateFullName ?? lead.candidateFullName,
          candidateGradeLevel: candidateGradeLevel ?? lead.candidateGradeLevel,
          guardianFullName: guardianFullName ?? lead.guardianFullName,
          guardianPhone: guardianPhone ?? lead.guardianPhone,
        },
      });
      enrollmentId = enrollment.id;

      await logActivity(tx, {
        tenantId: actor.tenantId!,
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "CRM adayından Ön Kayıt oluşturuldu",
        detail: `${lead.candidateFullName} — Enrollment ${enrollment.id}`,
      });
    }

    const updated = await tx.crmLead.update({
      where: { id: lead.id },
      data: { candidateFullName, candidateGradeLevel, guardianFullName, guardianPhone, school, guardianEmail, notes, stage, enrollmentId },
    });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "CRM adayı düzenlendi",
      detail: updated.candidateFullName,
    });

    return { kind: "updated" as const, lead: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "CRM adayı bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ lead: outcome.lead });
}

export async function DELETE(request: NextRequest, { params }: { params: { leadId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol CRM adayını silemez" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const lead = await tx.crmLead.findUnique({ where: { id: params.leadId } });
    if (!lead || lead.tenantId !== actor.tenantId) {
      return { kind: "not_found" as const };
    }
    if (lead.enrollmentId) {
      return { kind: "converted" as const };
    }

    await tx.crmLead.delete({ where: { id: lead.id } });

    await logActivity(tx, {
      tenantId: actor.tenantId!,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "CRM adayı silindi",
      detail: lead.candidateFullName,
    });

    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "CRM adayı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "converted") {
    return NextResponse.json({ message: "Ön Kayıt'a dönüşmüş bir CRM adayı silinemez" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
