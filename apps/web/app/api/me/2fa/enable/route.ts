import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";

/**
 * Kurulumu TAMAMLAR: /api/me/2fa/setup ile üretilen gizli anahtara karşı
 * kullanıcının authenticator uygulamasından okuduğu ilk 6 haneli kodu
 * doğrular; doğruysa totpEnabled=true yapar. Bu andan itibaren kullanıcının
 * girişi iki adımlı olur (bkz. /api/auth/login/verify).
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ message: "Kod zorunludur" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user?.totpSecret) {
    return NextResponse.json({ message: "Önce kurulumu başlatın." }, { status: 400 });
  }
  if (user.totpEnabled) {
    return NextResponse.json({ message: "İki faktörlü doğrulama zaten etkin." }, { status: 409 });
  }

  if (!verifyTotp(code, user.totpSecret)) {
    return NextResponse.json({ message: "Kod hatalı. Authenticator uygulamanızdaki güncel kodu girin." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: true } });
  return NextResponse.json({ ok: true, twoFactorEnabled: true });
}
