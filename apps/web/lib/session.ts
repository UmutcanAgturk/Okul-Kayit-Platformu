import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";

/**
 * SUPERADMIN'in Kurumlar sayfasından "Bu Şube Olarak Yönet"i seçtiğinde
 * hangi şubeyi seçtiğini taşıyan çerez (bkz. app/api/hq/acting-tenant).
 * İmzasız düz bir çerezdir — SUPERADMIN zaten prismaSuperadmin ile TÜM
 * tenant'lara erişebildiğinden bu çerez ek bir yetki VERMEZ, yalnızca
 * withBranchTenantContext'in (bkz. db-context.ts) hangi şubeye RLS
 * kapsamıyla scope edeceğini belirtir.
 */
export const ACTING_TENANT_COOKIE = "seviye360_acting_tenant";

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

  // Her zaman AYNI şekli (actingTenantId dahil) döner — SUPERADMIN dışındaki
  // roller için her zaman null, tek bir union tip yerine tutarlı bir tip
  // sağlar (bkz. app/api/branch/... route'larındaki actor.actingTenantId kullanımı).
  const actingTenantId = user.role === UserRole.SUPERADMIN ? (request.cookies.get(ACTING_TENANT_COOKIE)?.value ?? null) : null;
  return { ...user, actingTenantId };
}
