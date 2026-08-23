import { NextRequest, NextResponse } from "next/server";
import { prismaSuperadmin } from "@/lib/prisma-superadmin";
import { getSessionActor } from "@/lib/session";

/**
 * Oturumdaki kullanıcının cihaz push token'ını kaydeder/günceller. Mobil
 * uygulama giriş sonrası çağırır (bkz. apps/mobile). Token benzersizdir —
 * aynı cihaz farklı kullanıcıya geçerse token sahibi güncellenir.
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim() : null;
  const platform = typeof body.platform === "string" ? body.platform : null;
  if (!token) return NextResponse.json({ message: "token zorunludur" }, { status: 400 });

  await prismaSuperadmin.pushToken.upsert({
    where: { token },
    create: { userId: actor.id, token, platform },
    update: { userId: actor.id, platform },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : null;
  if (token) await prismaSuperadmin.pushToken.deleteMany({ where: { token, userId: actor.id } });
  return NextResponse.json({ ok: true });
}
