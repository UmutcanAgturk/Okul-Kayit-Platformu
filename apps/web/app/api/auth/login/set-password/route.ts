import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifyPasswordChangeToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

/**
 * İlk giriş zorunlu şifre değişiminin ikinci adımı: /api/auth/login (veya
 * MFA açıksa /api/auth/login/verify) şifreyi/kodu doğrulayıp
 * `passwordChangeRequired: true` + kısa ömürlü `changeToken` döndüğünde, istemci
 * kullanıcının yeni şifresini buraya gönderir. Şifre güncellenir,
 * `mustChangePassword` sıfırlanır ve gerçek oturum burada açılır (UserSession +
 * imzalı çerez) — yani kullanıcı ilk girişte tek akışta hem şifresini belirler
 * hem içeri girer.
 *
 * changeToken tek başına oturum açmaya yetmez (bkz. lib/auth.ts
 * createPasswordChangeToken) — yalnızca "kimlik bu tur zaten doğrulandı"
 * durumunu 15dk taşır. Yeni şifre, geçici şifreyle (T.C. Kimlik No) AYNI
 * olamaz.
 */
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const changeToken = typeof body.changeToken === "string" ? body.changeToken : null;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : null;

  if (!changeToken || !newPassword) {
    return NextResponse.json({ message: "Yeni şifre zorunludur" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ message: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır` }, { status: 400 });
  }

  const verified = verifyPasswordChangeToken(changeToken);
  if (!verified) {
    return NextResponse.json({ message: "Oturum doğrulama süresi doldu. Lütfen tekrar giriş yapın." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ message: "Hesap bulunamadı veya pasif." }, { status: 400 });
  }

  // Yeni şifre, ilk giriş için verilen geçici şifreyle (T.C. Kimlik No) aynı
  // olamaz — aksi halde "zorunlu değişim" anlamsız kalırdı.
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return NextResponse.json({ message: "Yeni şifre, geçici şifrenizden (T.C. Kimlik No) farklı olmalıdır." }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  const session = await prisma.userSession.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
  });
  const token = createSessionToken(user.id, session.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
