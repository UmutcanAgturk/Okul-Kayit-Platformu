import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

/**
 * PATCH: oturumdaki kullanıcının KENDİ şifresini değiştirir. User tablosu
 * RLS'e tabi değildir (bkz. /api/auth/login'in de tenant bağlamı olmadan
 * doğrudan `prisma.user` kullanması) — burada zaten yalnızca actor.id'nin
 * KENDİ satırı güncellenir, başka bir kullanıcıya erişim mümkün değildir.
 */
export async function PATCH(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Mevcut ve yeni şifre zorunludur" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ message: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır` }, { status: 400 });
  }

  const isValid = await verifyPassword(currentPassword, actor.passwordHash);
  if (!isValid) {
    return NextResponse.json({ message: "Mevcut şifre hatalı" }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: newHash } });

  return NextResponse.json({ ok: true });
}
