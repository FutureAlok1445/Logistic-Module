import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Database exception details can contain PII; HTTP handlers log only safe error categories.
    log: [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
