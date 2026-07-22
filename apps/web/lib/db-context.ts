import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { prismaSuperadmin } from "./prisma-superadmin";

type Actor = { tenantId: string | null; role: UserRole };

/**
 * Bir işlemi doğru RLS bağlamıyla çalıştırır:
 *  - SUPERADMIN  -> `superadmin_role` (BYPASSRLS) bağlantısı; tenant/rol
 *    filtresi uygulanmaz, tüm tenant'lar görünür (Genel Merkez'in
 *    tenantId'si zaten null olabilir, tek bir tenant'a scope edilemez).
 *  - Diğer roller -> `app_role` bağlantısı, TEK bir Postgres transaction'ı
 *    içinde `SET LOCAL app.tenant_id` / `SET LOCAL app.role` set edilir —
 *    transaction bitince bu ayarlar otomatik sıfırlanır, connection pool'daki
 *    başka bir isteğe SIZMAZ.
 */
export async function withTenantContext<T>(
  actor: Actor,
  fn: (tx: Prisma.TransactionClient | PrismaClient) => Promise<T>,
): Promise<T> {
  if (actor.role === UserRole.SUPERADMIN) {
    return fn(prismaSuperadmin);
  }
  if (!actor.tenantId) {
    throw new Error(`"${actor.role}" rolündeki kullanıcının bir tenantId'si olmalı (SUPERADMIN dışındaki roller için zorunlu).`);
  }
  const tenantId = actor.tenantId;
  const role = actor.role;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.role', ${role}, true)`;
    return fn(tx);
  });
}
