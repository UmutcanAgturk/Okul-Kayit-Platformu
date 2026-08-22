import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { prismaSuperadmin } from "./prisma-superadmin";

type Actor = { tenantId: string | null; role: UserRole; actingTenantId?: string | null };

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

/**
 * SUPERADMIN "Kurumlar" sayfasından bir şubeyi "Bu Şube Olarak Yönet" ile
 * seçtiğinde (bkz. lib/session.ts ACTING_TENANT_COOKIE, app/api/hq/acting-tenant)
 * o şubenin `/api/branch/...` route'larını kullanabilmesini sağlar.
 * `withTenantContext`'ten FARKI: SUPERADMIN için prismaSuperadmin (TAM bypass,
 * TÜM tenant'lar) yerine, gerçek bir BRANCH_ADMIN ile BİREBİR AYNI RLS
 * bağlamıyla (SET LOCAL app.tenant_id/app.role) TEK bir tenant'a scope eder —
 * "şube olarak yönet" modundaki bir SUPERADMIN, seçili olmayan başka HİÇBİR
 * şubenin verisini bu route'lar üzerinden göremez/değiştiremez (veritabanı
 * seviyesinde RLS ile garanti edilir, route kodunun doğruluğuna bağlı değildir).
 * Diğer roller için withTenantContext ile birebir aynı davranır.
 */
export class BranchScopeRequiredError extends Error {
  constructor() {
    super("Bu işlem için önce Kurumlar sayfasından \"Bu Şube Olarak Yönet\" ile bir şube seçmelisiniz.");
    this.name = "BranchScopeRequiredError";
  }
}

export async function withBranchTenantContext<T>(
  actor: Actor,
  fn: (tx: Prisma.TransactionClient | PrismaClient) => Promise<T>,
): Promise<T> {
  if (actor.role === UserRole.SUPERADMIN) {
    // KONSOLİDE MOD: Genel Merkez henüz bir şube seçmediyse (acting tenant
    // yok) route, superadmin_role (BYPASSRLS) ile çalışır — listeler TÜM
    // kurumların verisini birleşik döner. Tek bir tenant'a yazmayı gerektiren
    // işlemler ise effectiveTenantId üzerinden BranchScopeRequiredError
    // fırlatmaya devam eder (konsolide mod salt-okunurdur).
    if (!actor.actingTenantId) return fn(prismaSuperadmin);
    const tenantId = actor.actingTenantId;
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.role', ${UserRole.BRANCH_ADMIN}, true)`;
      return fn(tx);
    });
  }
  return withTenantContext(actor, fn);
}

/**
 * `withBranchTenantContext` callback'leri İÇİNDE, yeni kayıtların `tenantId`
 * alanını doldururken veya (RLS'in zaten filtrelediği bir satırı) tekrar
 * doğrularken kullanılır — `actor.tenantId!` DOĞRUDAN kullanılırsa, "şube
 * olarak yönet" modundaki bir SUPERADMIN için bu değer HER ZAMAN null olur
 * (SUPERADMIN'in kendi tenantId'si), seçtiği şube DEĞİL. Bu fonksiyon doğru
 * değeri (actingTenantId varsa onu, yoksa actor.tenantId'yi) döner.
 */
export function effectiveTenantId(actor: Actor): string {
  const id = actor.role === UserRole.SUPERADMIN ? actor.actingTenantId : actor.tenantId;
  if (!id) throw new BranchScopeRequiredError();
  return id;
}

/**
 * effectiveTenantId'nin konsolide-dostu varyantı: Genel Merkez şube
 * seçmemişse (konsolide mod) null döner — çağıran taraf tenant filtresini
 * atlayarak tüm kurumları kapsar. Diğer roller için effectiveTenantId ile
 * birebir aynıdır.
 */
export function effectiveTenantIdOrNull(actor: Actor): string | null {
  if (actor.role === UserRole.SUPERADMIN) return actor.actingTenantId ?? null;
  return effectiveTenantId(actor);
}

/**
 * where-clause'larda `tenantId: effectiveTenantId(actor)` yerine
 * `...tenantScopeFilter(actor)` yazılır: konsolide moddaki Genel Merkez için
 * boş obje döner (filtre yok → tüm kurumlar), diğer tüm durumlarda
 * `{ tenantId }` döner. Yalnızca OKUMA sorgularında kullanılmalıdır.
 */
export function tenantScopeFilter(actor: Actor): { tenantId?: string } {
  const id = effectiveTenantIdOrNull(actor);
  return id ? { tenantId: id } : {};
}
