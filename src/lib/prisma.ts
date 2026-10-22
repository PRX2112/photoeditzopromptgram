import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbCheckCache?: { ok: boolean; message: string; timestamp: number };
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Diagnostic helper to test the database connection with 30s cache to avoid blocking requests
 */
export async function checkDatabaseConnection(forceFresh: boolean = false): Promise<{
  ok: boolean;
  message: string;
}> {
  const dbUrl = process.env.DATABASE_URL || "";

  // If dummy or unconfigured URL in .env, immediately return false without network timeout
  if (!dbUrl || dbUrl.includes("dummy") || dbUrl.includes("example.com")) {
    return {
      ok: false,
      message: "Neon PostgreSQL database connection pending. Set DATABASE_URL in .env to connect your Neon branch.",
    };
  }

  const now = Date.now();
  if (!forceFresh && globalForPrisma.dbCheckCache && now - globalForPrisma.dbCheckCache.timestamp < 30000) {
    return {
      ok: globalForPrisma.dbCheckCache.ok,
      message: globalForPrisma.dbCheckCache.message,
    };
  }

  try {
    // Neon PostgreSQL quick ping
    await prisma.$queryRaw`SELECT 1`;
    const res = { ok: true, message: "Connected to Neon PostgreSQL successfully" };
    globalForPrisma.dbCheckCache = { ...res, timestamp: now };
    return res;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const res = {
      ok: false,
      message:
        errorMsg.includes("connect") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("Authentication failed")
          ? "PostgreSQL database connection pending. Please verify DATABASE_URL in .env."
          : `Database check error: ${errorMsg}`,
    };
    globalForPrisma.dbCheckCache = { ...res, timestamp: now };
    return res;
  }
}
