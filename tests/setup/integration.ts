/**
 * Integration test bootstrap.
 *
 * Point `TEST_DATABASE_URL` at a **disposable** database. The setup refuses to
 * run against the development database so a stray `npm test` cannot wipe real
 * job-search data.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

for (const file of [".env", ".env.test", ".env.local"]) {
  const full = path.join(root, file);
  if (existsSync(full)) config({ path: full, override: false });
}

const url =
  process.env.TEST_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL ?? "";

const urlFromDev = process.env.DATABASE_URL ?? "";

if (url && url === urlFromDev && urlFromDev !== "") {
  throw new Error(
    "TEST_DATABASE_URL is the same as DATABASE_URL. Integration tests truncate " +
      "every table between specs, so point them at a throwaway database:\n" +
      "  createdb jobsearch_crm_test\n" +
      "  TEST_DATABASE_URL=postgresql://jts:jts_dev_password@localhost:5432/jobsearch_crm_test",
  );
}

if (!url) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Integration tests need a real PostgreSQL " +
      "database. See tests/setup/integration.ts.",
  );
}

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: url,
  DIRECT_DATABASE_URL: url,
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? "test-secret-value-that-is-long-enough-000000000",
});
// Deliberately leave SMTP unset: tests assert that sending fails loudly rather
// than simulating success.
delete process.env.SMTP_HOST;
delete process.env.SMTP_PORT;
delete process.env.SMTP_FROM_EMAIL;
