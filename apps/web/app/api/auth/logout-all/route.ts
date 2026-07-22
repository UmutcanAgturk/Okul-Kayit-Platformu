import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

// Bir hesabın ele geçirilmiş olabileceğinden şüphelenildiğinde (çalınmış bir
// token dahil) kullanılacak "acil durum" düğmesi: geçerli bir oturumla
// çağrılmalı, ve çağıranın kendi hesabındaki İPTAL EDİLMEMİŞ tüm oturumları
// (bu isteği yapan cihaz dahil, tüm diğer cihazlar) tek seferde iptal eder.
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum bulunamadı" }, { status: 401 });
  }

  await prisma.userSession.updateMany({
    where: { userId: actor.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
