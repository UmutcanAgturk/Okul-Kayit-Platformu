import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * İletişim — gelen kutusundaki tek bir mesajı okundu işaretler (PATCH) ya da
 * yalnızca KENDİ gelen kutusundan kaldırır (DELETE, demo'daki `hiddenBy`'ın
 * gerçek karşılığı — mesajın kendisini ya da diğer alıcıların kopyasını
 * ETKİLEMEZ, yalnızca bu kullanıcının `MessageRecipient` satırı silinir).
 */
export async function PATCH(request: NextRequest, { params }: { params: { messageId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const recipient = await tx.messageRecipient.findUnique({
      where: { messageId_userId: { messageId: params.messageId, userId: actor.id } },
    });
    if (!recipient) return null;
    if (recipient.readAt) return recipient;
    return tx.messageRecipient.update({
      where: { messageId_userId: { messageId: params.messageId, userId: actor.id } },
      data: { readAt: new Date() },
    });
  });

  if (!result) {
    return NextResponse.json({ message: "Mesaj bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ readAt: result.readAt!.toISOString() });
}

export async function DELETE(request: NextRequest, { params }: { params: { messageId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const deleted = await withTenantContext(actor, async (tx) => {
    const recipient = await tx.messageRecipient.findUnique({
      where: { messageId_userId: { messageId: params.messageId, userId: actor.id } },
    });
    if (!recipient) return false;
    await tx.messageRecipient.delete({ where: { messageId_userId: { messageId: params.messageId, userId: actor.id } } });
    return true;
  });

  if (!deleted) {
    return NextResponse.json({ message: "Mesaj bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
