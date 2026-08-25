import { NextRequest, NextResponse } from "next/server";
import { AssignmentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

/**
 * Bir ödev teslimi — GET: teslim dosyasını (dataUrl) getirir. PATCH: öğretmen
 * puan + geri bildirim verir (status→GRADED) ve veliye bildirim gönderir
 * (sınav sonucu deseni). RLS: AssignmentSubmission üst-kayıt politikası.
 */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];
const acting = (a: { role: UserRole; actingTenantId?: string | null }) => a.role === UserRole.SUPERADMIN && !!a.actingTenantId;

export async function GET(request: NextRequest, { params }: { params: { assignmentId: string; submissionId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Yetkiniz yok" }, { status: 403 });

  const sub = await withBranchTenantContext(actor, (tx) =>
    tx.assignmentSubmission.findFirst({ where: { id: params.submissionId, assignmentId: params.assignmentId } }),
  );
  if (!sub) return NextResponse.json({ message: "Teslim bulunamadı" }, { status: 404 });
  return NextResponse.json({ fileName: sub.fileName, mimeType: sub.mimeType, dataUrl: sub.dataUrl, note: sub.note });
}

export async function PATCH(request: NextRequest, { params }: { params: { assignmentId: string; submissionId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !acting(actor)) return NextResponse.json({ message: "Bu rol puanlama yapamaz" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const grade = typeof body.grade === "string" && body.grade.trim() ? body.grade.trim() : null;
  const feedback = typeof body.feedback === "string" && body.feedback.trim() ? body.feedback.trim() : null;
  if (!grade) return NextResponse.json({ message: "Not (grade) zorunludur" }, { status: 400 });

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const sub = await tx.assignmentSubmission.findFirst({ where: { id: params.submissionId, assignmentId: params.assignmentId }, include: { assignment: true } });
    if (!sub) return { kind: "not_found" as const };

    await tx.assignmentSubmission.update({
      where: { id: sub.id },
      data: { grade, feedback, status: AssignmentStatus.GRADED, gradedAt: new Date(), gradedByUserId: actor.id },
    });

    const student = await tx.studentProfile.findUnique({
      where: { id: sub.studentId },
      include: { user: true, guardians: { include: { parent: { include: { user: true } } } } },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Ödev puanlandı",
      detail: `${sub.assignment.title} — ${student?.user.firstName} ${student?.user.lastName} — Not: ${grade}`,
    });

    const billing = student?.guardians.find((g) => g.isBillingResponsible) ?? student?.guardians[0];
    const contact = billing ? billing.parent.user : student?.user ?? null;
    return {
      kind: "ok" as const,
      title: sub.assignment.title,
      grade,
      studentName: student ? `${student.user.firstName} ${student.user.lastName}` : "",
      notifyTarget: contact ? { userId: contact.id, name: contact.firstName, phone: contact.phone, email: contact.email } : null,
    };
  });

  if (outcome.kind === "not_found") return NextResponse.json({ message: "Teslim bulunamadı" }, { status: 404 });

  if (outcome.notifyTarget) {
    void notify(outcome.notifyTarget, {
      sms: `Sn. ${outcome.notifyTarget.name}, ${outcome.studentName} icin "${outcome.title}" odevi degerlendirildi. Not: ${outcome.grade}. Seviye 360`,
      emailSubject: `Ödev Değerlendirildi: ${outcome.title} — Seviye 360`,
      emailText: `Sayın ${outcome.notifyTarget.name},\n\n${outcome.studentName} adına "${outcome.title}" ödevi değerlendirilmiştir. Not: ${outcome.grade}\n\nSeviye 360 Eğitim Kurumları`,
    }).catch(() => {});
    void sendPushToUser(outcome.notifyTarget.userId, `Ödev Değerlendirildi: ${outcome.title}`, `${outcome.studentName} — Not: ${outcome.grade}`, { type: "assignment-graded" }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
