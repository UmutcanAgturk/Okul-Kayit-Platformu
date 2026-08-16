import { NextRequest, NextResponse } from "next/server";
import { CrmLeadStage, GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * CRM — demo/seviye360-app.html'deki SCREENS["branch:crm"] Kanban'ının gerçek
 * karşılığı. Ön Kayıt'tan (bkz. app/api/branch/enrollments) ÖNCEKİ, henüz
 * finansal bir taahhüt (kapora) olmayan "aday havuzu" — bkz.
 * prisma/schema.prisma CrmLead modelindeki not.
 *
 * SUPERADMIN, yalnızca Kurumlar sayfasından "Bu Şube Olarak Yönet" ile bir
 * şube seçtiğinde (bkz. lib/db-context.ts withBranchTenantContext) buraya
 * erişebilir — RLS o seçilen tek şubeyle sınırlar.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const VALID_STAGES = ["ARANDI", "GORUSULDU", "DENEME_SINAVINA_GIRDI", "KAYIT_OLDU"];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol CRM aday havuzunu görüntüleyemez" }, { status: 403 });
  }

  const stage = request.nextUrl.searchParams.get("stage");
  if (stage && !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ message: `stage şunlardan biri olmalıdır: ${VALID_STAGES.join(", ")}` }, { status: 400 });
  }

  const leads = await withBranchTenantContext(actor, (tx) =>
    tx.crmLead.findMany({
      where: stage ? { stage: stage as CrmLeadStage } : undefined,
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol CRM adayı ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const candidateFullName = typeof body.candidateFullName === "string" && body.candidateFullName.trim() ? body.candidateFullName.trim() : null;
  const candidateGradeLevel = typeof body.candidateGradeLevel === "string" && body.candidateGradeLevel in GradeLevel ? (body.candidateGradeLevel as GradeLevel) : null;
  const guardianFullName = typeof body.guardianFullName === "string" && body.guardianFullName.trim() ? body.guardianFullName.trim() : null;
  const guardianPhone = typeof body.guardianPhone === "string" && body.guardianPhone.trim() ? body.guardianPhone.trim() : null;
  const school = typeof body.school === "string" && body.school.trim() ? body.school.trim() : null;
  const guardianEmail = typeof body.guardianEmail === "string" && body.guardianEmail.trim() ? body.guardianEmail.trim() : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!candidateFullName || !candidateGradeLevel || !guardianFullName || !guardianPhone) {
    return NextResponse.json(
      { message: "candidateFullName, candidateGradeLevel, guardianFullName ve guardianPhone zorunludur" },
      { status: 400 },
    );
  }

  const lead = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.crmLead.create({
      data: {
        tenantId: effectiveTenantId(actor),
        candidateFullName,
        candidateGradeLevel,
        guardianFullName,
        guardianPhone,
        school,
        guardianEmail,
        notes,
      },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "CRM adayı eklendi",
      detail: created.candidateFullName,
    });

    return created;
  });

  return NextResponse.json({ lead }, { status: 201 });
}
