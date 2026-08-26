import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { sendPushToUser } from "@/lib/push";

/** Konuşmaya mesaj gönderme. Yalnızca taraflar; karşı tarafa push bildirimi. */
export async function POST(request: NextRequest, { params }: { params: { conversationId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" && body.body.trim() ? body.body.trim() : null;
  if (!text) return NextResponse.json({ message: "Mesaj boş olamaz" }, { status: 400 });

  const result = await withTenantContext(actor, async (tx) => {
    const conv = await tx.conversation.findUnique({ where: { id: params.conversationId } });
    if (!conv) return { kind: "not_found" as const };
    const isParent = conv.parentUserId === actor.id;
    const isTeacher = conv.teacherUserId === actor.id;
    if (!isParent && !isTeacher) return { kind: "forbidden" as const };

    await tx.conversationMessage.create({ data: { conversationId: conv.id, senderUserId: actor.id, body: text } });
    await tx.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), ...(isParent ? { parentLastReadAt: new Date() } : { teacherLastReadAt: new Date() }) },
    });
    return { kind: "ok" as const, otherId: isParent ? conv.teacherUserId : conv.parentUserId, subject: conv.subject };
  });

  if (result.kind === "not_found") return NextResponse.json({ message: "Konuşma bulunamadı" }, { status: 404 });
  if (result.kind === "forbidden") return NextResponse.json({ message: "Bu konuşmaya erişiminiz yok" }, { status: 403 });

  void sendPushToUser(result.otherId, `Yeni mesaj: ${result.subject}`, text.slice(0, 120), { type: "conversation", conversationId: params.conversationId }).catch(() => {});
  return NextResponse.json({ ok: true }, { status: 201 });
}
