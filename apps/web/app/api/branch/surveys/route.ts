import { NextRequest, NextResponse } from "next/server";
import { SurveyAudience, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/** Anketler — memnuniyet/geri bildirim anketleri (tenant_isolation). */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;
const AUDIENCES = new Set(Object.values(SurveyAudience));

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol anketleri görüntüleyemez" }, { status: 403 });
  const surveys = await withBranchTenantContext(actor, (tx) =>
    tx.survey.findMany({ include: { _count: { select: { questions: true, responses: true } } }, orderBy: { createdAt: "desc" } }),
  );
  return NextResponse.json({
    surveys: surveys.map((s) => ({
      id: s.id, title: s.title, description: s.description, audience: s.audience, anonymous: s.anonymous,
      active: s.active, startAt: s.startAt ? s.startAt.toISOString() : null, endAt: s.endAt ? s.endAt.toISOString() : null,
      questionCount: s._count.questions, responseCount: s._count.responses,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol anket oluşturamaz" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim() : null;
  if (!title) return NextResponse.json({ message: "Anket başlığı zorunludur" }, { status: 400 });
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const audience = typeof b.audience === "string" && AUDIENCES.has(b.audience as SurveyAudience) ? (b.audience as SurveyAudience) : SurveyAudience.ALL;
  const anonymous = b.anonymous === true;
  const questionTexts = Array.isArray(b.questions) ? b.questions.filter((q: unknown) => typeof q === "string" && q.trim()).map((q: string) => q.trim()) : [];
  const survey = await withBranchTenantContext(actor, async (tx) => {
    const created = await tx.survey.create({
      data: {
        tenantId: effectiveTenantId(actor), title, description, audience, anonymous, createdByUserId: actor.id,
        questions: { create: questionTexts.map((text: string, i: number) => ({ order: i + 1, text, type: "TEXT" as const, options: [] })) },
      },
    });
    await logActivity(tx, { tenantId: effectiveTenantId(actor), actorUserId: actor.id, actorLabel: actorLabel(actor), action: "Anket oluşturuldu", detail: title });
    return created;
  });
  return NextResponse.json({ survey }, { status: 201 });
}
