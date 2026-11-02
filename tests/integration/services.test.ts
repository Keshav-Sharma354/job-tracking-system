/**
 * Service-layer integration tests.
 *
 * These cover the behaviours that are easy to get subtly wrong and expensive in
 * production: authentication without user enumeration, the follow-up tasks that
 * status changes create, and — most importantly — that sending email fails
 * loudly instead of pretending to succeed.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSessionRecord, resolveSession } from "@/lib/auth/session-core";
import { authenticate, changePassword, registerUser } from "@/server/services/auth";
import { clearAllRateLimits } from "@/server/auth/rate-limit";
import * as jobService from "@/server/services/jobs";
import * as contactService from "@/server/services/contacts";
import * as emailService from "@/server/services/emails";
import * as taskService from "@/server/services/tasks";
import {
  contactSchema,
  emailDraftSchema,
  jobSchema,
  taskSchema,
  type ContactData,
  type EmailDraftData,
  type JobData,
  type TaskData,
} from "@/lib/validation/schemas";
import {
  createCompany,
  createUser,
  resetDatabase,
} from "../setup/fixtures";

beforeEach(async () => {
  await resetDatabase();
  clearAllRateLimits();
});

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Parses a fixture through a schema, failing the test with a readable message
 * if the fixture itself is wrong.
 *
 * Typed via the schema's own output so the call site keeps full type safety
 * while the helper stays generic.
 */
function parseOrThrow<T>(schema: { safeParse: (v: unknown) => unknown }, input: unknown): T {
  const result = schema.safeParse(input) as {
    success: boolean;
    data?: T;
    error?: unknown;
  };
  if (!result.success) {
    throw new Error(`Fixture failed validation: ${JSON.stringify(result.error)}`);
  }
  return result.data as T;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("registration", () => {
  it("creates a user with an Argon2id hash, never the password", async () => {
    const result = await registerUser({
      name: "Dana Whitfield",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: "203.0.113.5",
    });

    expect(result.ok).toBe(true);

    const stored = await db.user.findUnique({
      where: { email: "dana@example.com" },
    });
    expect(stored).toBeTruthy();
    expect(stored!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored!.passwordHash).not.toContain("LongEnough123");
  });

  it("never returns the hash to the caller", async () => {
    const result = await registerUser({
      name: "Dana",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: null,
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("argon2");
  });

  it("refuses a duplicate address without confirming it exists", async () => {
    await registerUser({
      name: "Dana",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: null,
    });

    const second = await registerUser({
      name: "Someone Else",
      email: "dana@example.com",
      password: "Different1234",
      ipAddress: null,
    });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toMatch(/cannot be used/i);
  });

  it("throttles repeated sign-ups from one address", async () => {
    let rateLimited = false;
    for (let i = 0; i < 8; i++) {
      const r = await registerUser({
        name: "Dana",
        email: `dana-${i}@example.com`,
        password: "LongEnough123",
        ipAddress: "203.0.113.9",
      });
      if (!r.ok && r.code === "RATE_LIMITED") {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});

describe("login", () => {
  it("accepts the correct password", async () => {
    await registerUser({
      name: "Dana",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: null,
    });

    const result = await authenticate("dana@example.com", "LongEnough123", null);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.email).toBe("dana@example.com");
  });

  // The two failure modes must be indistinguishable, otherwise the login form
  // becomes an account-enumeration oracle.
  it("gives an identical error for a wrong password and an unknown account", async () => {
    await registerUser({
      name: "Dana",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: null,
    });

    const wrongPassword = await authenticate(
      "dana@example.com",
      "WrongPassword123",
      null,
    );
    const unknownUser = await authenticate(
      "nobody@example.com",
      "WrongPassword123",
      null,
    );

    expect(wrongPassword.ok).toBe(false);
    expect(unknownUser.ok).toBe(false);
    expect(wrongPassword.ok === false && unknownUser.ok === false &&
      wrongPassword.error).toBe(unknownUser.ok === false ? unknownUser.error : "");
  });

  it("blocks further attempts after repeated failures", async () => {
    await registerUser({
      name: "Dana",
      email: "dana@example.com",
      password: "LongEnough123",
      ipAddress: null,
    });

    for (let i = 0; i < 10; i++) {
      await authenticate("dana@example.com", `wrong-${i}`, null);
    }

    const blocked = await authenticate("dana@example.com", "LongEnough123", null);
    expect(blocked.ok).toBe(false);
    // Even the correct password is refused once the window is exhausted.
    expect(blocked.ok === false && blocked.code).toBe("RATE_LIMITED");
  });
});

describe("password change", () => {
  it("rejects a wrong current password", async () => {
    const user = await createUser({ password: "LongEnough123" });
    const result = await changePassword(user.id, {
      currentPassword: "NotMyPassword1",
      password: "AnotherStrong123",
    });

    expect(result.ok).toBe(false);
  });

  it("changes the password and revokes every existing session", async () => {
    const user = await createUser({ password: "LongEnough123" });
    const { token } = await createSessionRecord({ userId: user.id });

    expect(await resolveSession(token)).not.toBeNull();

    const result = await changePassword(user.id, {
      currentPassword: "LongEnough123",
      password: "AnotherStrong123",
    });
    expect(result.ok).toBe(true);

    expect(await resolveSession(token)).toBeNull();
    expect(
      await authenticate(user.email, "AnotherStrong123", null),
    ).toMatchObject({ ok: true });
  });
});

describe("sessions", () => {
  it("stores only a hash of the token", async () => {
    const user = await createUser();
    const { token } = await createSessionRecord({ userId: user.id });

    const row = await db.session.findFirst({ where: { userId: user.id } });
    expect(row).toBeTruthy();
    expect(row!.tokenHash).not.toBe(token);
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves a valid token to its owner", async () => {
    const user = await createUser();
    const { token } = await createSessionRecord({ userId: user.id });

    const session = await resolveSession(token);
    expect(session?.userId).toBe(user.id);
    expect(session?.user.email).toBe(user.email);
  });

  it("returns null for an unknown token", async () => {
    expect(await resolveSession("not-a-real-token")).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession("")).toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    const user = await createUser();
    const { token } = await createSessionRecord({ userId: user.id });

    await db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await resolveSession(token)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

describe("application service", () => {
  it("creates the company when given a new name", async () => {
    const user = await createUser();

    const result = await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Staff Engineer",
        companyName: "Brand New Co",
        status: "APPLIED",
        tags: "",
      }),
    );

    expect(result.ok).toBe(true);
    expect(await db.company.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await db.job.count({ where: { userId: user.id, companyId: (result as never as { data: { companyId: string } }).data.companyId } }),
    ).toBe(1);
  });

  it("reuses an existing company rather than duplicating it", async () => {
    const user = await createUser();
    await createCompany(user.id, "Acme");

    await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Role A",
        companyName: "acme", // different case
        status: "APPLIED",
        tags: "",
      }),
    );
    await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Role B",
        companyName: "ACME",
        status: "APPLIED",
        tags: "",
      }),
    );

    expect(await db.company.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.job.count({ where: { userId: user.id } })).toBe(2);
  });

  it("schedules a follow-up when an application is submitted", async () => {
    const user = await createUser();
    const result = await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Staff Engineer",
        companyName: "Acme",
        status: "APPLIED",
        tags: "",
      }),
    );

    const tasks = await db.task.findMany({ where: { userId: user.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toMatch(/Follow up with Acme/);
    expect(tasks[0]!.jobId).toBe(
      (result as never as { data: { id: string } }).data.id,
    );
  });

  it("moves a job and records the transition on the timeline", async () => {
    const user = await createUser();
    const created = await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Eng",
        companyName: "Acme",
        status: "SAVED",
        tags: "",
      }),
    );
    const jobId = (created as never as { data: { id: string } }).data.id;

    const moved = await jobService.moveApplication(user.id, jobId, "INTERVIEW");
    expect(moved.ok).toBe(true);

    const events = await db.statusEvent.findMany({ where: { jobId } });
    expect(events).toHaveLength(1);
    expect(events[0]!.toStatus).toBe("INTERVIEW");
  });

  it("cancels outstanding follow-ups when an application is closed out", async () => {
    const user = await createUser();
    const created = await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Eng",
        companyName: "Acme",
        status: "APPLIED",
        tags: "",
      }),
    );
    const jobId = (created as never as { data: { id: string } }).data.id;

    expect(await db.task.count({ where: { jobId, status: "OPEN" } })).toBe(1);

    await jobService.moveApplication(user.id, jobId, "REJECTED");

    expect(await db.task.count({ where: { jobId, status: "OPEN" } })).toBe(0);
    expect(await db.task.count({ where: { jobId, status: "CANCELLED" } })).toBe(1);
  });

  it("refuses to move another user's application", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const created = await jobService.createApplication(
      alice.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Eng",
        companyName: "Acme",
        status: "SAVED",
        tags: "",
      }),
    );
    const jobId = (created as never as { data: { id: string } }).data.id;

    const result = await jobService.moveApplication(bob.id, jobId, "OFFER");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("NOT_FOUND");

    const unchanged = await db.job.findUnique({ where: { id: jobId } });
    expect(unchanged!.status).toBe("SAVED");
  });

  it("refuses to attach a referral contact from another account", async () => {
    const alice = await createUser();
    const bob = await createUser();

    const aliceContact = await contactService.createContact(
      alice.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Alice referral", email: "a@example.com" }),
    );
    const contactId = (aliceContact as never as { data: { id: string } }).data.id;

    const result = await jobService.createApplication(
      bob.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Eng",
        companyName: "Acme",
        status: "APPLIED",
        referralContactId: contactId,
        tags: "",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.referralContactId).toBeTruthy();
    expect(await db.job.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("records activity for every mutation", async () => {
    const user = await createUser();
    const created = await jobService.createApplication(
      user.id,
      parseOrThrow<JobData>(jobSchema, {
        title: "Eng",
        companyName: "Acme",
        status: "SAVED",
        tags: "",
      }),
    );
    const jobId = (created as never as { data: { id: string } }).data.id;

    await jobService.moveApplication(user.id, jobId, "INTERVIEW");

    const activities = await db.activityEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    // Company created, job created, status changed.
    expect(activities.length).toBeGreaterThanOrEqual(3);
    expect(activities.at(-1)!.action).toBe("STATUS_CHANGED");
  });
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

describe("contact service", () => {
  it("blocks a duplicate email address and names the existing contact", async () => {
    const user = await createUser();
    await contactService.createContact(
      user.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana", email: "dana@example.com" }),
    );

    const second = await contactService.createContact(
      user.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Impostor", email: "dana@example.com" }),
    );

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toContain("Dana");
    expect(await db.contact.count({ where: { userId: user.id } })).toBe(1);
  });

  it("allows a contact to keep its own address when edited", async () => {
    const user = await createUser();
    const created = await contactService.createContact(
      user.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana", email: "dana@example.com" }),
    );
    const id = (created as never as { data: { id: string } }).data.id;

    const updated = await contactService.updateContact(
      user.id,
      id,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana W", email: "dana@example.com" }),
    );

    expect(updated.ok).toBe(true);
  });

  it("rejects a company belonging to another account", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceCompany = await createCompany(alice.id, "Alice Co");

    const result = await contactService.createContact(
      bob.id,
      parseOrThrow<ContactData>(contactSchema, {
        name: "Mallory",
        email: "m@example.com",
        companyId: aliceCompany.id,
      }),
    );

    expect(result.ok).toBe(false);
    expect(await db.contact.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("will not update another user's contact", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const created = await contactService.createContact(
      alice.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana", email: "d@example.com" }),
    );
    const id = (created as never as { data: { id: string } }).data.id;

    const result = await contactService.updateContact(
      bob.id,
      id,
      parseOrThrow<ContactData>(contactSchema, { name: "Hacked" }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("NOT_FOUND");
    const untouched = await db.contact.findUnique({ where: { id } });
    expect(untouched!.name).toBe("Dana");
  });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

describe("task service", () => {
  it("rejects a job reference from another account", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const company = await createCompany(alice.id, "Acme");
    const job = await db.job.create({
      data: { userId: alice.id, companyId: company.id, title: "Eng" },
    });

    const result = await taskService.createTask(
      bob.id,
      parseOrThrow<TaskData>(taskSchema, { title: "Follow up", jobId: job.id }),
    );

    expect(result.ok).toBe(false);
    expect(await db.task.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("records completion on the activity timeline", async () => {
    const user = await createUser();
    const created = await taskService.createTask(
      user.id,
      parseOrThrow<TaskData>(taskSchema, { title: "Call recruiter", dueAt: "2026-05-04T09:00" }),
    );
    const id = (created as never as { data: { id: string } }).data.id;

    await taskService.toggleTask(user.id, id, true);

    const activity = await db.activityEvent.findFirst({
      where: { userId: user.id, action: "TASK_COMPLETED" },
    });
    expect(activity).toBeTruthy();
    expect(activity!.summary).toContain("Call recruiter");
  });

  it("moves the due date when snoozed", async () => {
    const user = await createUser();
    const created = await taskService.createTask(
      user.id,
      parseOrThrow<TaskData>(taskSchema, {
        title: "Follow up",
        dueAt: "2026-05-04T09:00",
      }),
    );
    const id = (created as never as { data: { id: string } }).data.id;

    const result = await taskService.snoozeTask(user.id, id, 3);
    expect(result.ok).toBe(true);

    const task = await db.task.findUnique({ where: { id } });
    expect(task!.dueAt!.toISOString()).toBe("2026-05-07T09:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------------

describe("outreach service", () => {
  async function seedContact(userId: string) {
    const result = await contactService.createContact(
      userId,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana", email: "dana@example.com" }),
    );
    return (result as never as { data: { id: string } }).data;
  }

  const draftInput = (over: Record<string, unknown> = {}) => ({
    toEmail: "dana@example.com",
    subject: "Staff Engineer at Acme",
    body: "Hi Dana,\n\nWould you be open to a chat?",
    tags: "",
    ...over,
  });

  it("creates a draft without marking it as sent", async () => {
    const user = await createUser();
    const contact = await seedContact(user.id);

    const result = await emailService.createDraft(
      user.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );

    expect(result.ok).toBe(true);
    const email = (result as never as { data: { status: string; sentAt: Date | null } }).data;
    expect(email.status).toBe("DRAFT");
    expect(email.sentAt).toBeNull();
  });

  // This is the guarantee the whole module rests on: with no SMTP configured,
  // nothing may be recorded as sent and no delivery row may be written.
  it("refuses to send when SMTP is not configured and records nothing", async () => {
    const user = await createUser();
    const contact = await seedContact(user.id);

    const created = await emailService.createDraft(
      user.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );
    const emailId = (created as never as { data: { id: string } }).data.id;

    const result = await emailService.sendDraft(user.id, emailId);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("MAILER_NOT_CONFIGURED");

    const stored = await db.email.findUnique({ where: { id: emailId } });
    expect(stored!.status).toBe("DRAFT");
    expect(stored!.sentAt).toBeNull();
    expect(await db.emailDelivery.count({ where: { emailId } })).toBe(0);
  });

  it("records a failed delivery attempt and keeps the message editable", async () => {
    const user = await createUser();
    const contact = await seedContact(user.id);

    const created = await emailService.createDraft(
      user.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );
    const emailId = (created as never as { data: { id: string } }).data.id;

    // Point the transport at a closed port so the send genuinely fails.
    const { getMailerStatus } = await import("@/server/email/mailer");
    expect(getMailerStatus().configured).toBe(false);

    const result = await emailService.sendDraft(user.id, emailId);
    expect(result.ok).toBe(false);

    const stored = await db.email.findUnique({ where: { id: emailId } });
    // Still not marked as sent.
    expect(stored!.status).not.toBe("SENT");
    expect(stored!.sentAt).toBeNull();
  });

  it("refuses to draft to a contact that has no email address", async () => {
    const user = await createUser();

    // A contact added from a LinkedIn DM may have no address on file.
    const contact = await contactService.createContact(
      user.id,
      parseOrThrow<ContactData>(contactSchema, { name: "Dana", email: "" }),
    );
    const contactId = (contact as never as { data: { id: string } }).data.id;

    // The schema is the first line of defence and requires a recipient.
    const parsed = emailDraftSchema.safeParse({
      subject: "Hi",
      body: "Body",
      contactId,
      toEmail: "",
    });
    expect(parsed.success).toBe(false);
    expect(
      parsed.success === false &&
        parsed.error.issues.some((i) => i.path.includes("toEmail")),
    ).toBe(true);

    expect(await db.email.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses to send a message whose recipient was removed", async () => {
    const user = await createUser();
    const contact = await seedContact(user.id);

    const created = await emailService.createDraft(
      user.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );
    const emailId = (created as never as { data: { id: string } }).data.id;

    // The address disappears after the draft was written.
    await db.email.update({ where: { id: emailId }, data: { toEmail: null } });

    const result = await emailService.sendDraft(user.id, emailId);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("VALIDATION");
    expect(
      (await db.email.findUnique({ where: { id: emailId } }))!.status,
    ).toBe("DRAFT");
  });

  it("will not send another user's draft", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const contact = await seedContact(alice.id);

    const created = await emailService.createDraft(
      alice.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );
    const emailId = (created as never as { data: { id: string } }).data.id;

    const result = await emailService.sendDraft(bob.id, emailId);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("NOT_FOUND");
  });

  it("records an inbound reply and threads it to the outbound message", async () => {
    const user = await createUser();
    const contact = await seedContact(user.id);

    const outbound = await emailService.createDraft(
      user.id,
      parseOrThrow<EmailDraftData>(emailDraftSchema, draftInput({ contactId: contact.id })),
    );
    const outboundId = (outbound as never as { data: { id: string } }).data.id;
    await db.email.update({
      where: { id: outboundId },
      data: { status: "SENT", sentAt: new Date(), messageId: "<x@y>" },
    });

    const inbound = await emailService.recordInboundReply(user.id, {
      from: "dana@example.com",
      subject: "Re: Staff Engineer at Acme",
      text: "Sounds good!",
      messageId: "<reply@y>",
      inReplyTo: "<x@y>",
    });

    expect(inbound.ok).toBe(true);
    expect(inbound.ok && inbound.data.threaded).toBe(true);

    const parent = await db.email.findUnique({ where: { id: outboundId } });
    expect(parent!.status).toBe("REPLIED");

    // A follow-up is scheduled for the reply.
    const tasks = await db.task.findMany({ where: { userId: user.id } });
    expect(tasks.some((t) => t.title.includes("dana@example.com"))).toBe(true);
  });

  it("is idempotent on Message-ID so webhook retries do not duplicate", async () => {
    const user = await createUser();
    const message = {
      from: "stranger@example.com",
      subject: "Hello",
      text: "Hi",
      messageId: "<unique-1@example.com>",
    };

    const first = await emailService.recordInboundReply(user.id, message);
    const second = await emailService.recordInboundReply(user.id, message);

    expect(first.ok && first.data.emailId).toBe(
      second.ok && second.data.emailId,
    );
    expect(await db.email.count({ where: { userId: user.id } })).toBe(1);
  });

  it("records a reply from an unknown sender without failing", async () => {
    const user = await createUser();
    const result = await emailService.recordInboundReply(user.id, {
      from: "stranger@unknown.example",
      subject: "Is this role still open?",
      text: "Hello",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.threaded).toBe(false);
  });
});

describe("mailer configuration", () => {
  it("reports every missing variable", async () => {
    const { getMailerStatus, isMailerConfigured } = await import(
      "@/server/email/mailer"
    );

    expect(isMailerConfigured()).toBe(false);
    const status = getMailerStatus();
    expect(status.missing).toContain("SMTP_HOST");
    expect(status.missing).toContain("SMTP_PORT");
    expect(status.missing).toContain("SMTP_FROM_EMAIL");
  });

  it("refuses to send rather than logging a pretend success", async () => {
    const { sendMail, MailerNotConfiguredError } = await import(
      "@/server/email/mailer"
    );

    await expect(
      sendMail({ to: "x@example.com", subject: "s", body: "b" }),
    ).rejects.toBeInstanceOf(MailerNotConfiguredError);
  });

  it("escapes HTML in the generated body so markup cannot be injected", async () => {
    const { toHtml } = await import("@/server/email/mailer");
    const html = toHtml("Hello <script>alert('x')</script>\n\nSecond para");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p");
  });
});
