import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * İletişim — gelen kutusu (herkes: STUDENT/PARENT/TEACHER/BRANCH_ADMIN/...).
 * `MessageRecipient`'te kendi RLS'i yok (bkz. şemadaki not), bu yüzden
 * `userId = actor.id` filtresi uygulama katmanında yapılır; `message`
 * include'u yine de Message'ın `tenant_isolation` RLS'ine tabidir.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const rows = await withTenantContext(actor, (tx) =>
    tx.messageRecipient.findMany({
      where: { userId: actor.id },
      include: { message: true },
      orderBy: { message: { createdAt: "desc" } },
    }),
  );

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.message.id,
      senderLabel: r.message.senderLabel,
      title: r.message.title,
      body: r.message.body,
      audienceLabel: r.message.audienceLabel,
      createdAt: r.message.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    })),
    unreadCount: rows.filter((r) => !r.readAt).length,
  });
}
