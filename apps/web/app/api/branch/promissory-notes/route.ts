import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { formatDocumentNo } from "@/lib/documents";

/**
 * Senet — demo/seviye360-app.html'deki createSenet()'in gerçek karşılığı.
 * Kayıt Defteri'nden BİLİNÇLİ OLARAK bağımsızdır (bkz. prisma/schema.prisma'daki
 * "BELGELER" yorumu). Opsiyonel `studentId` yalnızca hangi öğrenciyle
 * ilişkili olduğunu belgeler — StudentProfile RLS ile tenant'a scope
 * edilmiştir (bkz. prisma/rls/README.md), bu yüzden başka bir tenant'ın
 * öğrencisi burada zaten görünmez.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol senetleri görüntüleyemez" }, { status: 403 });
  }

  const notes = await withTenantContext(actor, (tx) =>
    tx.promissoryNote.findMany({ orderBy: { createdAt: "desc" } }),
  );

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol senet oluşturamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const issueDate = typeof body.issueDate === "string" && !isNaN(Date.parse(body.issueDate)) ? new Date(body.issueDate) : null;
  const dueDate = typeof body.dueDate === "string" && !isNaN(Date.parse(body.dueDate)) ? new Date(body.dueDate) : null;
  const debtorName = typeof body.debtorName === "string" && body.debtorName.trim() ? body.debtorName.trim() : null;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;

  if (!issueDate || !dueDate || !debtorName || !amount) {
    return NextResponse.json({ message: "issueDate, dueDate, debtorName ve amount (>0) zorunludur" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const outcome = await withTenantContext(actor, async (tx) => {
    if (studentId) {
      const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
      if (!student) return { kind: "student_not_found" as const };
    }

    // Bir INSERT'i catch(P2002) ile AYNI transaction içinde yeniden denemek
    // çalışmaz (bkz. invoices/route.ts'teki aynı yorum) — önce boş bir `no`
    // bulunur (yalnızca SELECT'lerle), INSERT en sonda ve yalnızca BİR KEZ
    // çalıştırılır.
    const count = await tx.promissoryNote.count({ where: { tenantId: actor.tenantId! } });
    let no = formatDocumentNo("SNT", year, count + 1);
    for (let attempt = 1; attempt < 20; attempt++) {
      const existing = await tx.promissoryNote.findUnique({ where: { tenantId_no: { tenantId: actor.tenantId!, no } } });
      if (!existing) break;
      no = formatDocumentNo("SNT", year, count + 1 + attempt);
    }

    const promissoryNote = await tx.promissoryNote.create({
      data: { tenantId: actor.tenantId!, no, issueDate, dueDate, debtorName, amount, note, studentId, createdByUserId: actor.id },
    });
    return { kind: "created" as const, promissoryNote };
  });

  if (outcome.kind === "student_not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ promissoryNote: outcome.promissoryNote }, { status: 201 });
}
