/**
 * Route handler tests.
 *
 * These cover the two externally reachable surfaces: the CSV import/export
 * endpoint (authenticated, tenant-scoped) and the inbound email webhook
 * (shared-secret authenticated, and able to route a reply to the right account).
 *
 * `next/headers` is mocked so the handlers see a controllable session without a
 * running Next.js server.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sessionUserId = { current: null as string | null };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      sessionUserId.current
        ? { name, value: `token-for-${sessionUserId.current}` }
        : undefined,
  }),
  headers: async () => new Headers(),
}));

const WEBHOOK_SECRET = "test-webhook-secret-value-000000000";
const WEBHOOK_URL = "http://localhost/api/webhooks/email-inbound";

/*
 * Set before any application module is imported. `@/lib/env` memoises on first
 * read, and importing the database client triggers that read — so a value set
 * after the first import would never be seen. The "disabled" case at the end of
 * this file resets the module registry to exercise the other branch.
 */
process.env.EMAIL_INBOUND_SECRET = WEBHOOK_SECRET;

const { db } = await import("@/lib/db");
const { hashSessionToken } = await import("@/lib/auth/token");
const { createUser, createCompany, resetDatabase } = await import(
  "../setup/fixtures"
);
const { GET, POST } = await import("@/app/api/export/route");
const { createEmail } = await import("@/server/repo/emails");

/** Points the mocked cookie at a real session for `userId`. */
async function signInAs(userId: string) {
  // The mock returns `token-for-<id>`, so the session row is stored under that
  // token's digest rather than a freshly generated one.
  await db.session.deleteMany({ where: { userId } });
  await db.session.create({
    data: {
      tokenHash: hashSessionToken(`token-for-${userId}`),
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  sessionUserId.current = userId;
}

beforeEach(async () => {
  await resetDatabase();
  sessionUserId.current = null;
});

afterAll(async () => {
  await db.$disconnect();
});

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

describe("CSV export", () => {
  it("returns 401 without a session", async () => {
    const response = await GET(request("/api/export?entity=applications"));
    expect(response.status).toBe(401);
  });

  it("exports the caller's applications as CSV", async () => {
    const user = await createUser();
    await signInAs(user.id);
    const company = await createCompany(user.id, "Acme");

    await db.job.create({
      data: { userId: user.id, companyId: company.id, title: "Staff Engineer" },
    });

    const response = await GET(request("/api/export?entity=applications"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "applications-",
    );

    const csv = await response.text();
    expect(csv).toContain("Staff Engineer");
    expect(csv).toContain("Acme");
  });

  // The whole point of the tenancy model: an export must never include another
  // account's rows.
  it("never includes another user's records", async () => {
    const alice = await createUser();
    const bob = await createUser();

    const aliceCompany = await createCompany(alice.id, "Alice Corp");
    await db.job.create({
      data: {
        userId: alice.id,
        companyId: aliceCompany.id,
        title: "Alice's Secret Role",
      },
    });

    await signInAs(bob.id);
    const csv = await (await GET(request("/api/export?entity=applications"))).text();

    expect(csv).not.toContain("Alice's Secret Role");
    expect(csv).not.toContain("Alice Corp");
  });

  it("escapes embedded commas and quotes", async () => {
    const user = await createUser();
    await signInAs(user.id);
    const company = await createCompany(user.id, "Acme, Inc.");
    await db.job.create({
      data: { userId: user.id, companyId: company.id, title: 'The "Best" Role' },
    });

    const csv = await (await GET(request("/api/export?entity=applications"))).text();
    expect(csv).toContain('"Acme, Inc."');
    // Inner quotes are doubled and the cell is wrapped: The ""Best"" Role
    expect(csv).toContain('"The ""Best"" Role"');
  });

  it("rejects an unknown entity", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const response = await GET(request("/api/export?entity=secrets"));
    expect(response.status).toBe(400);
  });
});

describe("CSV import", () => {
  it("rejects an unauthenticated upload", async () => {
    const response = await POST(request("/api/export?entity=applications", {
      method: "POST",
    }));
    expect(response.status).toBe(401);
  });

  it("imports rows and reports per-row outcomes", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const csv = [
      "company,title,status,priority,salary_min",
      "Globex,Backend Engineer,APPLIED,HIGH,120000",
      "Initech,Product Designer,INTERVIEW,MEDIUM,90000",
    ].join("\n");

    const form = new FormData();
    form.append("file", new File([csv], "apps.csv", { type: "text/csv" }));

    const response = await POST(
      request("/api/export?entity=applications", { method: "POST", body: form }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.created).toBe(2);
    expect(await db.job.count({ where: { userId: user.id } })).toBe(2);
    expect(await db.company.count({ where: { userId: user.id } })).toBe(2);
  });

  // Partial success is the point: one bad row must not discard the good ones.
  it("imports the good rows and reports the bad ones", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const csv = [
      "company,title",
      "Globex,Backend Engineer",
      ",Missing Company", // no company
      "Initech,", // no title
    ].join("\n");

    const form = new FormData();
    form.append("file", new File([csv], "apps.csv", { type: "text/csv" }));

    const response = await POST(
      request("/api/export?entity=applications", { method: "POST", body: form }),
    );
    const payload = await response.json();

    expect(payload.created).toBe(1);
    expect(payload.skipped).toBe(2);
    expect(payload.errors).toHaveLength(2);
    expect(payload.errors[0]).toMatch(/Row 3/);
  });

  it("accepts human-readable status labels and raw enum values alike", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const csv = [
      "company,title,status",
      "Globex,Role One,Phone Screen",
      "Initech,Role Two,INTERVIEW",
    ].join("\n");

    const form = new FormData();
    form.append("file", new File([csv], "apps.csv", { type: "text/csv" }));

    await POST(
      request("/api/export?entity=applications", { method: "POST", body: form }),
    );

    const jobs = await db.job.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
      select: { title: true, status: true },
    });

    expect(jobs.map((j) => j.status)).toEqual(["PHONE_SCREEN", "INTERVIEW"]);
  });

  it("round-trips its own export", async () => {
    const user = await createUser();
    await signInAs(user.id);
    const company = await createCompany(user.id, "Roundtrip Co");

    await db.job.create({
      data: {
        userId: user.id,
        companyId: company.id,
        title: "Imported, Once",
        notes: "Contains, a comma",
        tags: ["remote", "fintech"],
      },
    });

    const exported = await (await GET(request("/api/export?entity=applications"))).text();

    // Remove the original, then re-import into the same account.
    await db.job.deleteMany({ where: { userId: user.id } });

    const form = new FormData();
    form.append("file", new File([exported], "export.csv", { type: "text/csv" }));

    const payload = await (
      await POST(
        request("/api/export?entity=applications", { method: "POST", body: form }),
      )
    ).json();

    expect(payload.created).toBe(1);

    const restored = await db.job.findFirstOrThrow({ where: { userId: user.id } });
    expect(restored.title).toBe("Imported, Once");
    expect(restored.notes).toBe("Contains, a comma");
    expect(restored.tags.sort()).toEqual(["fintech", "remote"]);
  });

  it("refuses an empty file", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const form = new FormData();
    form.append("file", new File([""], "empty.csv", { type: "text/csv" }));

    const response = await POST(
      request("/api/export?entity=applications", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
  });

  it("refuses import for entities it does not support", async () => {
    const user = await createUser();
    await signInAs(user.id);

    const form = new FormData();
    form.append("file", new File(["a,b"], "x.csv", { type: "text/csv" }));

    const response = await POST(
      request("/api/export?entity=tasks", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Inbound email webhook
// ---------------------------------------------------------------------------

/**
 * The route module is loaded once and reused. `vi.resetModules()` in the final
 * test forces a re-read of the environment with the secret removed.
 */
const route = await import("@/app/api/webhooks/email-inbound/route");

function postWebhook(payload: unknown, secret?: string) {
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

describe("inbound email webhook", () => {
  it("advertises its authentication scheme when enabled", async () => {
    const response = await route.GET();
    const info = await response.json();

    expect(info.enabled).toBe(true);
    expect(info.method).toBe("POST");
    expect(info.authentication).toContain("Bearer");
  });

  it("rejects a request with no secret", async () => {
    const response = await route.POST(
      postWebhook({ from: "a@example.com", subject: "hi", text: "hi" }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const response = await route.POST(
      postWebhook(
        { from: "a@example.com", subject: "hi", text: "hi" },
        "not-the-secret",
      ),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a secret of the right length but wrong content", async () => {
    const response = await route.POST(
      postWebhook(
        { from: "a@example.com", subject: "hi", text: "hi" },
        "X".repeat(WEBHOOK_SECRET.length),
      ),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a malformed payload with field-level detail", async () => {
    const response = await route.POST(
      postWebhook({ from: "not-an-email", subject: "hi", text: "hi" }, WEBHOOK_SECRET),
    );

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.issues[0].field).toContain("from");
  });

  it("rejects a body that is not JSON", async () => {
    const response = await route.POST(
      postWebhook("not json at all", WEBHOOK_SECRET),
    );
    expect(response.status).toBe(400);
  });

  it("records a reply against the account that sent the original", async () => {
    const user = await createUser();

    const outbound = await createEmail(user.id, {
      contactId: null,
      jobId: null,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "SENT",
      toEmail: "dana@example.com",
      toName: "Dana",
      fromEmail: "me@example.com",
      subject: "Staff Engineer at Acme",
      body: "Hi",
      scheduledAt: null,
    });

    await db.email.update({
      where: { id: outbound.id },
      data: { messageId: "<original@example.com>" },
    });

    const response = await route.POST(
      postWebhook(
        {
          from: "dana@example.com",
          to: "me@example.com",
          subject: "Re: Staff Engineer at Acme",
          text: "Sounds good!",
          messageId: "<reply-1@example.com>",
          inReplyTo: "<original@example.com>",
        },
        WEBHOOK_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.recorded).toBe(true);
    expect(payload.threaded).toBe(true);

    // The reply landed on the right user's account, threaded to the original.
    const inbound = await db.email.findUniqueOrThrow({
      where: { id: payload.emailId },
    });
    expect(inbound.userId).toBe(user.id);
    expect(inbound.direction).toBe("INBOUND");
    expect(inbound.inReplyToId).toBe(outbound.id);

    const parent = await db.email.findUniqueOrThrow({
      where: { id: outbound.id },
    });
    expect(parent.status).toBe("REPLIED");
  });

  // A provider retrying a delivery must not create a second copy of the reply.
  it("is idempotent on Message-ID", async () => {
    const user = await createUser();

    const outbound = await createEmail(user.id, {
      contactId: null,
      jobId: null,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "SENT",
      toEmail: "dana@example.com",
      toName: "Dana",
      fromEmail: "me@example.com",
      subject: "Another role",
      body: "Hi",
      scheduledAt: null,
    });
    await db.email.update({
      where: { id: outbound.id },
      data: { messageId: "<original-2@example.com>" },
    });

    const payload = {
      from: "dana@example.com",
      to: "me@example.com",
      subject: "Re: Another role",
      text: "Hello",
      messageId: "<idempotent-1@example.com>",
      inReplyTo: "<original-2@example.com>",
    };

    await route.POST(postWebhook(payload, WEBHOOK_SECRET));
    const before = await db.email.count({ where: { userId: user.id } });

    const second = await route.POST(postWebhook(payload, WEBHOOK_SECRET));
    const after = await db.email.count({ where: { userId: user.id } });

    // 1 outbound + exactly 1 inbound, despite the retry.
    expect(before).toBe(2);
    expect(after).toBe(2);
    expect(second.status).toBe(200);
  });

  it("accepts but does not record a reply it cannot attribute", async () => {
    const user = await createUser();
    const other = await createUser();

    const response = await route.POST(
      postWebhook(
        {
          from: "nobody@example.com",
          subject: "Unrelated",
          text: "Hello",
          messageId: "<orphan@example.com>",
        },
        WEBHOOK_SECRET,
      ),
    );

    // 202, not an error: retrying will not help, and a 4xx would loop forever.
    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.recorded).toBe(false);

    expect(await db.email.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.email.count({ where: { userId: other.id } })).toBe(0);
  });

  // Declared last: resetting the module registry affects every later import.
  it("reports itself as disabled when no secret is configured", async () => {
    vi.resetModules();
    delete process.env.EMAIL_INBOUND_SECRET;
    const fresh = await import("@/app/api/webhooks/email-inbound/route");

    const info = await (await fresh.GET()).json();
    expect(info.enabled).toBe(false);

    // 501 Not Implemented: the endpoint is off, not broken.
    const response = await fresh.POST(
      postWebhook({ from: "a@example.com", subject: "hi", text: "hi" }),
    );
    expect(response.status).toBe(501);
  });
});

afterAll(() => {
  delete process.env.EMAIL_INBOUND_SECRET;
});
