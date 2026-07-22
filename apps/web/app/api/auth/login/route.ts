import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifyPassword, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";

/**
 * Gerçek kimlik doğrulama — bu depodaki ilk giriş endpoint'i. Şu ana kadar
 * (bkz. prisma/rls/README.md "Kalan, hâlâ açık boşluk") diğer route'lar
 * "collectedByUserId"/"requestedByUserId" gibi istemcinin serbestçe beyan
 * ettiği alanlara güveniyordu. Bu route'tan sonra o alanlar kaldırıldı —
 * kimlik artık yalnızca burada doğrulanan, imzalı bir oturum çerezinden gelir
 * (bkz. lib/session.ts).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : null;
  const password = typeof body.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ message: "E-posta ve şifre zorunludur" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Kullanıcı bulunamasa bile aynı süre/mesajla yanıt ver — e-posta adresinin
  // sistemde kayıtlı olup olmadığını dışarıdan ayırt edilemez kılmak için
  // gerçek bir hash'e karşı (sabit, geçersiz bir hash) doğrulama yapılır.
  const passwordHash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const isValid = user?.isActive ? await verifyPassword(password, passwordHash) : await verifyPassword(password, passwordHash);

  if (!user || !user.isActive || !isValid) {
    return NextResponse.json({ message: "E-posta veya şifre hatalı" }, { status: 401 });
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
