import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordChangeToken, createSessionToken, verifyMfaToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { peekRateLimit, recordAttempt } from "@/lib/rate-limit";

/**
 * İki faktörlü girişin ikinci adımı: /api/auth/login şifreyi doğrulayıp
 * `mfaRequired: true` + kısa ömürlü `mfaToken` döndüğünde, istemci kullanıcının
 * authenticator kodunu buraya gönderir. Kod doğruysa gerçek oturum burada
 * açılır (UserSession + imzalı çerez).
 *
 * mfaToken tek başına oturum açmaya yetmez (bkz. lib/auth.ts createMfaToken);
 * yalnızca "şifre bu tur zaten doğrulandı" durumunu 5dk taşır. Kod denemeleri
 * de hesap bazlı rate limit'e tabidir (brute-force'a karşı).
 */
const MFA_LIMIT = 5;
const MFA_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mfaToken = typeof body.mfaToken === "string" ? body.mfaToken : null;
  const code = typeof body.code === "string" ? body.code : null;

  if (!mfaToken || !code) {
    return NextResponse.json({ message: "Kod zorunludur" }, { status: 400 });
  }

  const verified = verifyMfaToken(mfaToken);
  if (!verified) {
    return NextResponse.json({ message: "Oturum doğrulama süresi doldu. Lütfen tekrar giriş yapın." }, { status: 401 });
  }

  const rateLimitKey = `mfa:${verified.userId}`;
  const lockout = peekRateLimit(rateLimitKey, MFA_LIMIT, MFA_WINDOW_MS);
  if (!lockout.allowed) {
    return NextResponse.json(
      { message: "Çok fazla hatalı kod. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(lockout.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ message: "İki faktörlü doğrulama bu hesap için etkin değil." }, { status: 400 });
  }

  if (!verifyTotp(code, user.totpSecret)) {
    recordAttempt(rateLimitKey, MFA_LIMIT, MFA_WINDOW_MS);
    return NextResponse.json({ message: "Kod hatalı veya süresi dolmuş." }, { status: 401 });
  }

  // TOTP doğru — ama hesap hâlâ geçici şifreyle (T.C. Kimlik No) ilk girişini
  // yapıyorsa oturumu açmadan önce yeni şifre belirlet (bkz. login/route.ts'teki
  // aynı kontrol; MFA açık kullanıcılarda buraya düşer).
  if (user.mustChangePassword) {
    return NextResponse.json({ passwordChangeRequired: true, changeToken: createPasswordChangeToken(user.id) });
  }

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
