import { PrismaClient } from "@prisma/client";

// SUPERADMIN (Genel Merkez) istekleri için AYRI bir bağlantı — `superadmin_role`
// veritabanı seviyesinde BYPASSRLS'e sahiptir (bkz. prisma/rls/README.md).
// Genel Merkez kullanıcısının `User.tenantId`'si null olabildiğinden (tek bir
// tenant'a bağlı değildir), lib/prisma.ts'deki `app_role` bağlantısıyla tenant
// izolasyonlu sorgu çalıştırmak SUPERADMIN için anlamsızdır — set_config'e null
// tenant vermek "hiçbir şey görünmez" sonucunu verir, "her şey görünür" değil.
// Bu yüzden SUPERADMIN isteklerinde bilinçli olarak farklı bir bağlantı/rol
// kullanılır (bkz. lib/db-context.ts).
const globalForPrisma = globalThis as unknown as { prismaSuperadmin?: PrismaClient };

export const prismaSuperadmin =
  globalForPrisma.prismaSuperadmin ??
  new PrismaClient({
    datasources: { db: { url: process.env.SUPERADMIN_DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaSuperadmin = prismaSuperadmin;
