/**
 * Environment configuration.
 *
 * This module is intentionally free of `server-only` so that it can be loaded by
 * Prisma CLI hooks, seed scripts and the test runner. It must never be imported
 * from a Client Component — `tests/architecture/env-imports.test.ts` enforces
 * that rule.
 */
import { z } from "zod";

const boolish = z
  .enum(["1", "0", "true", "false", "yes", "no"])
  .transform((v) => v === "1" || v === "true" || v === "yes");

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().optional(),

  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  ALLOW_REGISTRATION: boolish.default(true),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: boolish.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.email().optional(),
  SMTP_FROM_NAME: z.string().optional(),

  EMAIL_INBOUND_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function load(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;

  // A short secret is the one misconfiguration that silently destroys session
  // integrity, so fail loudly rather than starting in a weakened state.
  if (env.NODE_ENV === "production" && env.SESSION_SECRET.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters in production.",
    );
  }

  return env;
}

let cached: ServerEnv | undefined;

/** Validated server environment. Memoised after the first access. */
export function getEnv(): ServerEnv {
  cached ??= load();
  return cached;
}

/** Values that are safe to reference from the browser. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const isProduction = () => getEnv().NODE_ENV === "production";
export const isTest = () => getEnv().NODE_ENV === "test";

/**
 * Connection string for the application at runtime. When a pooled
 * `DATABASE_URL` is paired with a direct one for migrations, the direct URL is
 * used here so that the app does not depend on session-affinity support in the
 * pooler.
 */
export function runtimeDatabaseUrl(): string {
  const env = getEnv();
  return env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;
}
