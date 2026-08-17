import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * İletişim — gönderilen bir mesajı GERİ ÇEKME (task #89). `/api/messages/[id]`
 * DELETE'i yalnızca çağıranın kendi `MessageRecipient` kopyasını (gelen
 * kutusu görünümünü) siler — burada ise mesajın KENDİSİ silinir (cascade ile
 * tüm alıcı kopyaları ve ekler de gider), yalnızca gönderen kendi mesajı için
 * çağırabilir. Demo'da böyle bir geri alma zaman sınırı yoktu, bu yüzden
 * burada da süre kısıtı eklenmedi.
 */
export async function DELETE(request: NextRequest, { params }: { params: { messageId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const existing = await tx.message.findUnique({ where: { id: params.messageId } });
    if (!existing) return { kind: "not_found" as const };
    if (existing.senderUserId !== actor.id) return { kind: "forbidden" as const };

    await tx.message.delete({ where: { id: params.messageId } });
    await logActivity(tx, {
      tenantId: existing.tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Mesaj geri çekildi",
      detail: existing.title,
    });
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Mesaj bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ message: "Yalnızca kendi gönderdiğiniz mesajı geri çekebilirsiniz" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
