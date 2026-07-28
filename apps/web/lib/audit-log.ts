import { randomUUID } from "crypto";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Genel Merkez Yöneticisi",
  BRANCH_ADMIN: "Şube Yöneticisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
  ACCOUNTING: "Muhasebe Görevlisi",
  TEACHER: "Öğretmen",
  STUDENT: "Öğrenci",
  PARENT: "Veli",
};

export function actorLabel(actor: { firstName: string; lastName: string; role: UserRole }) {
  return `${actor.firstName} ${actor.lastName} (${ROLE_LABEL[actor.role]})`;
}

/**
 * Demo'daki `logActivity()`'nin gerçek karşılığı — bir `tx` içinde çağrılır
 * (bkz. `withTenantContext`), böylece log kaydı asıl işlemle aynı transaction'da
 * (aynı commit/rollback) yazılır.
 *
 * `tx.auditLogEntry.create()` YERİNE bilinçli olarak ham `$executeRaw` INSERT
 * kullanılır: Prisma'nın `.create()`'i her zaman bir `RETURNING` ekler, ve
 * Postgres RLS'de `RETURNING`'li bir INSERT, eklenen satırın SELECT
 * politikasını da (INSERT'in kendi WITH CHECK'ine ek olarak) sağlamasını
 * ister — burada AuditLogEntry'nin SELECT politikası yalnızca SUPERADMIN/
 * BRANCH_ADMIN'e izin verir (bkz. şemadaki not), bu yüzden örneğin bir
 * TEACHER'ın disiplin kaydı eklerken tetiklediği log yazımı `RETURNING`
 * yüzünden "new row violates row-level security policy" hatasıyla
 * PATLARDI. Düz bir INSERT (RETURNING'siz) yalnızca INSERT'in WITH CHECK'ini
 * gerektirir, bu da her rol için "tenantId eşleşiyor mu" kadar basittir.
 */
export async function logActivity(
  tx: Prisma.TransactionClient | PrismaClient,
  params: { tenantId: string; actorUserId: string; actorLabel: string; action: string; detail?: string },
) {
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO "AuditLogEntry" ("id", "tenantId", "actorUserId", "actorLabel", "action", "detail")
    VALUES (${id}, ${params.tenantId}, ${params.actorUserId}, ${params.actorLabel}, ${params.action}, ${params.detail ?? null})
  `;
}
