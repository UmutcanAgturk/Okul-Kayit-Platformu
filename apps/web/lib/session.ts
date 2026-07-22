import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";

/**
 * İsteği yapan kullanıcıyı, önceki turdaki `resolveActingUser(userId)`'nin
 * aksine artık istemcinin beyan ettiği bir alandan DEĞİL, giriş sırasında
 * verilen imzalı oturum çerezinden (bkz. /api/auth/login) türetir. Token
 * geçerliyse bile kullanıcıyı DB'den taze okur (tenant/rol değişmiş olabilir,
 * yalnızca token'daki eski bilgiye güvenilmez).
 *
 * `resolveActingUser` (bkz. db-context.ts) hâlâ mevcut ama artık yalnızca
 * "bu userId'nin tenant/rolü ne?" sorusunu cevaplıyor — kimin bu userId
 * olduğunu KANITLAMAK bu fonksiyonun işi.
 */
export async function getSessionActor(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.isActive) return null;
  return user;
}
