/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until Postgres refuses new clients. Caching on
 * `globalThis` keeps exactly one pool per process.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runtimeDatabaseUrl } from "@/lib/env";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: runtimeDatabaseUrl(),
    // Cap idle clients so a scaled-out deployment cannot exhaust Postgres'
    // connection limit. Tune to match your plan's max_connections.
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.PRISMA_LOG === "1"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/** Helper so callers can reason about nullability without importing Prisma. */
export function isUniqueConstraintError(
  error: unknown,
): error is { code: "P2002"; meta?: { target?: string[] | string } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}
