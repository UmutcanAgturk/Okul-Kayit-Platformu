import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/** Konuşma detayı — mesajlar + okundu işaretleme. Yalnızca taraflar erişir. */
export async function GET(request: NextRequest, { params }: { params: { conversationId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const data = await withTenantContext(actor, async (tx) => {
    const conv = await tx.conversation.findUnique({ where: { id: params.conversationId } });
    if (!conv) return { kind: "not_found" as const };
    const isParent = conv.parentUserId === actor.id;
    const isTeacher = conv.teacherUserId === actor.id;
    if (!isParent && !isTeacher) return { kind: "forbidden" as const };

    const messages = await tx.conversationMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } });

    // Okundu işaretle
    await tx.conversation.update({
      where: { id: conv.id },
      data: isParent ? { parentLastReadAt: new Date() } : { teacherLastReadAt: new Date() },
    });

    const otherId = isParent ? conv.teacherUserId : conv.parentUserId;
    const other = await tx.user.findUnique({ where: { id: otherId }, select: { firstName: true, lastName: true } });
    const student = conv.studentId ? await tx.studentProfile.findUnique({ where: { id: conv.studentId }, include: { user: true } }) : null;

    return {
      kind: "ok" as const,
      subject: conv.subject,
      otherName: other ? `${other.firstName} ${other.lastName}` : "—",
      otherRole: isParent ? "Öğretmen" : "Veli",
      studentName: student ? `${student.user.firstName} ${student.user.lastName}` : null,
      messages: messages.map((m) => ({ id: m.id, body: m.body, mine: m.senderUserId === actor.id, createdAt: m.createdAt.toISOString() })),
    };
  });

  if (data.kind === "not_found") return NextResponse.json({ message: "Konuşma bulunamadı" }, { status: 404 });
  if (data.kind === "forbidden") return NextResponse.json({ message: "Bu konuşmaya erişiminiz yok" }, { status: 403 });
  return NextResponse.json(data);
}
