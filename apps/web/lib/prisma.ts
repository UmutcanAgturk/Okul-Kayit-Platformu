import { PrismaClient } from "@prisma/client";

// Next.js dev sunucusunda hot-reload her modülü yeniden çalıştırır; global'e
// tutmazsak her reload'da yeni bir PrismaClient (ve yeni bir connection pool)
// oluşur ve "too many clients" hatasına yol açar.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
