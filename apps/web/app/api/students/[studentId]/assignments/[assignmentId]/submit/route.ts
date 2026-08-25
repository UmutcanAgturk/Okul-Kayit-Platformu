import { NextRequest, NextResponse } from "next/server";
import { AssignmentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Öğrenci/veli ödev teslimi. Metin (note) + opsiyonel tek dosya (base64,
 * PaymentReceipt deseni). Aynı ödev için tekrar teslimde günceller (upsert).
 * status → SUBMITTED. Yetki: STUDENT (kendi) / PARENT (velisi olduğu).
 */
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_DATA_URL = 3_500_000; // ~2.5MB

export async function POST(request: NextRequest, { params }: { params: { studentId: string; assignmentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : null;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : null;
  const dataUrl = typeof body.dataUrl === "string" && body.dataUrl ? body.dataUrl : null;

  if (dataUrl) {
    if (!mimeType || !ACCEPTED_MIME.includes(mimeType)) return NextResponse.json({ message: "Desteklenmeyen dosya türü (JPG/PNG/WEBP/GIF/PDF)" }, { status: 400 });
    if (dataUrl.length > MAX_DATA_URL) return NextResponse.json({ message: "Dosya çok büyük (en fazla ~2.5MB)" }, { status: 400 });
  }
  if (!note && !dataUrl) return NextResponse.json({ message: "Teslim için bir not veya dosya gerekir" }, { status: 400 });

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const own = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (own?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parent = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const g = parent ? await tx.studentGuardian.findUnique({ where: { studentId_parentId: { studentId: student.id, parentId: parent.id } } }) : null;
      if (!g) return { kind: "forbidden" as const };
    } else {
      return { kind: "forbidden" as const };
    }

    const assignment = await tx.assignment.findUnique({ where: { id: params.assignmentId } });
    if (!assignment) return { kind: "assignment_not_found" as const };
    if (assignment.classroomId && assignment.classroomId !== student.classroomId) return { kind: "not_targeted" as const };

    const data = { status: AssignmentStatus.SUBMITTED, submittedAt: new Date(), note, fileName, mimeType, dataUrl };
    const sub = await tx.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
      create: { assignmentId: assignment.id, studentId: student.id, ...data },
      update: data,
    });
    return { kind: "ok" as const, id: sub.id };
  });

  if (result.kind === "not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  if (result.kind === "assignment_not_found") return NextResponse.json({ message: "Ödev bulunamadı" }, { status: 404 });
  if (result.kind === "not_targeted") return NextResponse.json({ message: "Bu ödev sizin sınıfınıza atanmamış" }, { status: 400 });
  if (result.kind === "forbidden") return NextResponse.json({ message: "Bu öğrenci adına teslim yapamazsınız" }, { status: 403 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
