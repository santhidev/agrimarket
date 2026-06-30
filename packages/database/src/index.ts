import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Re-exports for consumers (apps/web imports from "@agrimarket/database").
export { redis } from "./redis";
export { OtpService } from "./otp";

/**
 * Prisma client for AgriMarket, backed by PostgreSQL via the @prisma/adapter-pg
 * driver adapter (per prisma-database-setup skill). Use the exported `prisma`
 * singleton everywhere — never construct PrismaClient directly.
 *
 * DATABASE_URL must be set in the consuming app's environment (e.g. apps/web/.env).
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set in the environment.");
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

// Singleton: avoid exhausting the connection pool during Next.js hot reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Idempotently seed the bootstrap admin user from a phone number.
 * Called by the seed script (apps/web/scripts/seed.ts) using ADMIN_PHONE.
 */
export async function seedAdmin(phone: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    // Ensure the admin flag is set on an already-existing user.
    if (!existing.isAdmin) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true },
      });
    }
    return;
  }

  await prisma.user.create({
    data: {
      phone,
      isAdmin: true,
    },
  });
}
