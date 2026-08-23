import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";

/** İki faktörlü doğrulamanın durumunu döner. */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  return NextResponse.json({ twoFactorEnabled: actor.totpEnabled });
}

/**
 * İki faktörlü doğrulamayı KAPATIR. Kötü niyetli birinin ele geçirdiği açık
 * oturumdan 2FA'yı sessizce kapatmasını zorlaştırmak için, kapatma güncel bir
 * authenticator kodu VEYA hesap şifresi ile doğrulanmalıdır.
 */
export async function DELETE(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : null;
  const password = typeof body.password === "string" ? body.password : null;

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user || !user.totpEnabled) {
    return NextResponse.json({ message: "İki faktörlü doğrulama zaten kapalı." }, { status: 409 });
  }

  const okByCode = code && user.totpSecret ? verifyTotp(code, user.totpSecret) : false;
  const okByPassword = password ? await verifyPassword(password, user.passwordHash) : false;
  if (!okByCode && !okByPassword) {
    return NextResponse.json({ message: "Kapatmak için güncel authenticator kodu veya hesap şifreniz gerekli." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: false, totpSecret: null } });
  return NextResponse.json({ ok: true, twoFactorEnabled: false });
}
