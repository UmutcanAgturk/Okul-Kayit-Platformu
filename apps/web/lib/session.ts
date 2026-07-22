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
 * Token'ın imzası geçerli olsa bile artık tek başına yeterli değil: token'ın
 * içindeki `sid` (session id), `UserSession` tablosunda hâlâ iptal edilmemiş
 * ve süresi dolmamış bir satıra karşılık gelmeli. Bu, 7 günlük geçerlilik
 * süresi dolmadan da bir oturumun (çalınmış bir token dahil) logout veya
 * logout-all ile geriye dönük iptal edilebilmesini sağlar — bkz.
 * `/api/auth/logout` ve `/api/auth/logout-all`.
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

  const session = await prisma.userSession.findUnique({ where: { id: verified.sessionId } });
  if (!session || session.userId !== verified.userId) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.isActive) return null;
  return user;
}
