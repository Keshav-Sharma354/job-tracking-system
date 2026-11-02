import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import { isMailerConfigured } from "@/server/email/mailer";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe.
 *
 * Returns 503 when the database is unreachable so a load balancer stops sending
 * traffic. Mailer configuration is reported but does not affect the status: the
 * app is fully usable for everything except sending.
 *
 * No authentication, because orchestrators call this before a user session
 * exists. It therefore exposes only a boolean database check — no versions, no
 * counts, nothing about the data itself.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: { ok: boolean; latencyMs: number; error?: string };

  try {
    await db.$queryRaw`SELECT 1`;
    database = { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    database = {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }

  const healthy = database.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        mailer: { configured: isMailerConfigured() },
      },
      environment: isProduction() ? "production" : "development",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
