/**
 * Manual smoke check.
 *
 * Signs in against a running dev server and asserts that every authenticated
 * route returns 200 with its expected content.
 *
 *   npm run dev                      # terminal 1
 *   npx tsx scripts/smoke.ts         # terminal 2
 *
 * The session is issued by calling the application's own
 * `createSessionRecord`, rather than by scraping the sign-in form, so the check
 * exercises the real session cookie the app sets. Credentials of the demo
 * account must exist (`npm run db:seed -- --demo`).
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import {
  createSessionRecord,
  SESSION_COOKIE_NAME,
} from "../src/lib/auth/session-core";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "DemoPassword123";

/**
 * Routes checked *while signed in*. Each must return 200 and contain every
 * listed marker.
 */
const CHECKS: { path: string; expect: RegExp[] }[] = [
  {
    path: "/dashboard",
    expect: [/Active applications/, /Pipeline/, /Interviews this week/],
  },
  { path: "/jobs", expect: [/Applications/] },
  { path: "/jobs/board", expect: [/Phone Screen/] },
  { path: "/contacts", expect: [/Contacts/] },
  { path: "/companies", expect: [/Companies/] },
  { path: "/emails", expect: [/Outreach/] },
  { path: "/templates", expect: [/Templates/] },
  { path: "/tasks", expect: [/Follow-ups/] },
  { path: "/notes", expect: [/Notes/] },
  { path: "/reports", expect: [/Reports/] },
  { path: "/settings", expect: [/Settings/] },
  { path: "/search?q=northwind", expect: [/Search/] },
];

/** Routes checked *without* a session. */
const ANONYMOUS_CHECKS: { path: string; expect: RegExp[] }[] = [
  { path: "/login", expect: [/Sign in/, /Email/, /Password/] },
];

/** Requests have to time out: a hung dev server should fail the check, not hang it. */
const REQUEST_TIMEOUT_MS = 30_000;

async function get(path: string, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(
      `No user ${EMAIL}. Create the demo account first:\n  npm run db:seed -- --demo --reset`,
    );
    process.exit(1);
  }

  // Verify the password is what we think it is, so a stale seed is obvious.
  const { verifyPassword } = await import("../src/lib/auth/password");
  if (!(await verifyPassword(PASSWORD, user.passwordHash))) {
    console.error(
      `The password for ${EMAIL} does not match SMOKE_PASSWORD. ` +
        "Update SMOKE_PASSWORD or reseed the demo account.",
    );
    process.exit(1);
  }

  const { token } = await createSessionRecord({ userId: user.id });
  const cookie = `${SESSION_COOKIE_NAME}=${token}`;
  console.log(`→ Session issued for ${EMAIL}\n`);

  const failures: string[] = [];

  // Anonymous checks first: no cookie should get the sign-in form.
  for (const check of ANONYMOUS_CHECKS) {
    try {
      const response = await get(check.path);
      const body = await response.text();
      const missing = check.expect.filter((p) => !p.test(body));

      if (response.status !== 200 || missing.length > 0) {
        failures.push(`${check.path} (anonymous) → HTTP ${response.status}`);
        console.log(`  ✗ ${check.path} (anonymous)`);
      } else {
        console.log(`  ✓ ${check.path} (anonymous)`);
      }
    } catch (error) {
      failures.push(`${check.path} (anonymous) → ${String(error)}`);
      console.log(`  ✗ ${check.path} (anonymous) — ${String(error)}`);
    }
  }

  console.log();

  for (const check of CHECKS) {
    try {
      const response = await get(check.path, cookie);
      const body = await response.text();
      const missing = check.expect.filter((pattern) => !pattern.test(body));

      if (response.status !== 200) {
        failures.push(`${check.path} → HTTP ${response.status}`);
        console.log(`  ✗ ${check.path} (HTTP ${response.status})`);
      } else if (missing.length > 0) {
        const names = missing.map((m) => m.source).join(", ");
        failures.push(`${check.path} → missing ${names}`);
        console.log(`  ✗ ${check.path} (missing ${names})`);
      } else {
        console.log(`  ✓ ${check.path}`);
      }
    } catch (error) {
      failures.push(`${check.path} → ${String(error)}`);
      console.log(`  ✗ ${check.path} — ${String(error)}`);
    }
  }

  // Clean up the temporary session.
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.$disconnect();

  console.log();
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`All ${CHECKS.length + ANONYMOUS_CHECKS.length} routes rendered correctly.`);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
