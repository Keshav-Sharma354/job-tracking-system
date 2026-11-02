/**
 * Repository-level integration tests against a real PostgreSQL database.
 *
 * The tenancy tests are the important ones: every repository function takes a
 * `userId`, and these specs prove that a correct-looking id belonging to another
 * account resolves to `null`/no-op rather than to that account's data.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as jobRepo from "@/server/repo/jobs";
import * as contactRepo from "@/server/repo/contacts";
import * as taskRepo from "@/server/repo/tasks";
import * as noteRepo from "@/server/repo/notes";
import * as emailRepo from "@/server/repo/emails";
import * as activityRepo from "@/server/repo/activity";
import {
  createCompany,
  createJob,
  createUser,
  resetDatabase,
} from "../setup/fixtures";
import type { ContactData } from "@/server/repo/contacts";

beforeEach(resetDatabase);
afterAll(async () => {
  await db.$disconnect();
});

describe("job repository", () => {
  it("creates a job and links it to the company", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");

    const job = await jobRepo.createJob(user.id, {
      companyId: company.id,
      title: "Staff Engineer",
      url: "https://jobs.acme.com/1",
      location: "Remote",
      employmentType: "FULL_TIME",
      workMode: "REMOTE",
      status: "APPLIED",
      priority: "HIGH",
      salaryMin: 180000,
      salaryMax: 220000,
      salaryCurrency: "USD",
      salaryPeriod: "YEAR",
      appliedAt: null,
      deadlineAt: null,
      resumeVersionId: null,
      referralContactId: null,
      notes: null,
      tags: ["remote"],
    });

    expect(job.title).toBe("Staff Engineer");
    expect(job.company.name).toBe("Acme");
    // Moving out of SAVED records the application date automatically.
    expect(job.appliedAt).toBeInstanceOf(Date);
  });

  it("leaves appliedAt null when the job is only saved", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");

    const job = await jobRepo.createJob(user.id, {
      companyId: company.id,
      title: "Saved lead",
      url: null,
      location: null,
      employmentType: "FULL_TIME",
      workMode: null,
      status: "SAVED",
      priority: "MEDIUM",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "USD",
      salaryPeriod: "YEAR",
      appliedAt: null,
      deadlineAt: null,
      resumeVersionId: null,
      referralContactId: null,
      notes: null,
      tags: [],
    });

    expect(job.appliedAt).toBeNull();
  });

  it("records a status event when the status changes", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    const job = await createJob(user.id, { title: "Eng", companyId: company.id });

    await jobRepo.changeJobStatus(user.id, job.id, "INTERVIEW", "Recruiter call");

    const events = await jobRepo.listStatusEvents(user.id, job.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.fromStatus).toBe("SAVED");
    expect(events[0]!.toStatus).toBe("INTERVIEW");
    expect(events[0]!.note).toBe("Recruiter call");
  });

  it("does not record an event when the status is unchanged", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    const job = await createJob(user.id, {
      title: "Eng",
      companyId: company.id,
      status: "INTERVIEW",
    });

    await jobRepo.changeJobStatus(user.id, job.id, "INTERVIEW");
    expect(await jobRepo.listStatusEvents(user.id, job.id)).toHaveLength(0);
  });

  it("filters by status and by free text", async () => {
    const user = await createUser();
    const acme = await createCompany(user.id, "Acme");
    const globex = await createCompany(user.id, "Globex");

    await createJob(user.id, {
      title: "Rust Engineer",
      companyId: acme.id,
      status: "APPLIED",
    });
    await createJob(user.id, {
      title: "Product Designer",
      companyId: globex.id,
      status: "INTERVIEW",
    });

    const applied = await jobRepo.listJobs(user.id, { statuses: ["APPLIED"] });
    expect(applied.items).toHaveLength(1);
    expect(applied.items[0]!.title).toBe("Rust Engineer");

    const byTitle = await jobRepo.listJobs(user.id, { q: "designer" });
    expect(byTitle.items).toHaveLength(1);

    // The company name is searchable even though it lives on another table.
    const byCompany = await jobRepo.listJobs(user.id, { q: "globex" });
    expect(byCompany.items).toHaveLength(1);
  });

  it("paginates with a stable total", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    for (let i = 0; i < 7; i++) {
      await createJob(user.id, { title: `Role ${i}`, companyId: company.id });
    }

    const first = await jobRepo.listJobs(user.id, { page: 1, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.total).toBe(7);
    expect(first.pageCount).toBe(3);

    const last = await jobRepo.listJobs(user.id, { page: 3, pageSize: 3 });
    expect(last.items).toHaveLength(1);

    // Pages must not overlap.
    const ids = new Set([
      ...first.items.map((j) => j.id),
      ...(await jobRepo.listJobs(user.id, { page: 2, pageSize: 3 })).items.map(
        (j) => j.id,
      ),
      ...last.items.map((j) => j.id),
    ]);
    expect(ids.size).toBe(7);
  });

  describe("tenancy", () => {
    it("returns null for another user's job", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const company = await createCompany(alice.id, "Acme");
      const job = await createJob(alice.id, {
        title: "Alice's role",
        companyId: company.id,
      });

      expect(await jobRepo.getJobById(bob.id, job.id)).toBeNull();
    });

    it("refuses to delete another user's job", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const company = await createCompany(alice.id, "Acme");
      const job = await createJob(alice.id, {
        title: "Alice's role",
        companyId: company.id,
      });

      expect(await jobRepo.deleteJob(bob.id, job.id)).toBe(false);
      expect(await db.job.count({ where: { id: job.id } })).toBe(1);
    });

    it("refuses to change another user's job status", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const company = await createCompany(alice.id, "Acme");
      const job = await createJob(alice.id, {
        title: "Alice's role",
        companyId: company.id,
      });

      expect(await jobRepo.changeJobStatus(bob.id, job.id, "OFFER")).toBeNull();

      const unchanged = await db.job.findUnique({ where: { id: job.id } });
      expect(unchanged!.status).toBe("SAVED");
    });

    it("never lists another user's jobs", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const company = await createCompany(alice.id, "Acme");
      await createJob(alice.id, { title: "Alice's role", companyId: company.id });

      const bobList = await jobRepo.listJobs(bob.id);
      expect(bobList.total).toBe(0);
    });

    it("does not leak counts across accounts", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const company = await createCompany(alice.id, "Acme");
      await createJob(alice.id, {
        title: "A",
        companyId: company.id,
        status: "INTERVIEW",
      });

      expect((await jobRepo.countByStatus(bob.id)).INTERVIEW ?? 0).toBe(0);
      expect((await jobRepo.countByStatus(alice.id)).INTERVIEW).toBe(1);
    });
  });

  it("cascades deletes from company to jobs", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    await createJob(user.id, { title: "Eng", companyId: company.id });

    await db.company.delete({ where: { id: company.id } });

    expect(await db.job.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("contact repository", () => {
  const contactInput = (over: Partial<ContactData> = {}): ContactData => ({
    name: "Someone",
    email: null,
    phone: null,
    linkedinUrl: null,
    title: null,
    companyId: null,
    contactType: "OTHER",
    relationship: "UNKNOWN",
    lastContactedAt: null,
    notes: null,
    tags: [],
    ...over,
  });

  it("allows many contacts without an email but blocks duplicate addresses", async () => {
    const user = await createUser();

    await contactRepo.createContact(user.id, contactInput({ name: "No Email A" }));
    await contactRepo.createContact(user.id, contactInput({ name: "No Email B" }));

    expect(
      await db.contact.count({ where: { userId: user.id, email: null } }),
    ).toBe(2);

    await contactRepo.createContact(
      user.id,
      contactInput({ name: "Dana", email: "dana@example.com" }),
    );

    await expect(
      contactRepo.createContact(
        user.id,
        contactInput({ name: "Impostor", email: "dana@example.com" }),
      ),
    ).rejects.toThrow();
  });

  it("permits the same address for two different users", async () => {
    const alice = await createUser();
    const bob = await createUser();

    await contactRepo.createContact(
      alice.id,
      contactInput({ name: "Dana", email: "dana@example.com" }),
    );
    await expect(
      contactRepo.createContact(
        bob.id,
        contactInput({ name: "Dana", email: "dana@example.com" }),
      ),
    ).resolves.toBeTruthy();
  });

  it("filters by type and by company", async () => {
    const user = await createUser();
    const acme = await createCompany(user.id, "Acme");
    const globex = await createCompany(user.id, "Globex");

    await contactRepo.createContact(
      user.id,
      contactInput({
        name: "Recruiter",
        email: "r@acme.com",
        companyId: acme.id,
        contactType: "RECRUITER",
        relationship: "WEAK",
      }),
    );
    await contactRepo.createContact(
      user.id,
      contactInput({
        name: "Engineer",
        email: "e@globex.com",
        companyId: globex.id,
        title: "Staff Engineer",
        contactType: "ENGINEER",
        relationship: "STRONG",
      }),
    );

    expect(
      (await contactRepo.listContacts(user.id, { contactType: "RECRUITER" })).items,
    ).toHaveLength(1);
    expect(
      (await contactRepo.listContacts(user.id, { companyId: globex.id })).items,
    ).toHaveLength(1);
  });

  it("does not return another user's contacts", async () => {
    const alice = await createUser();
    const bob = await createUser();

    await contactRepo.createContact(
      alice.id,
      contactInput({ name: "Alice contact", email: "a@example.com" }),
    );

    expect((await contactRepo.listContacts(bob.id)).total).toBe(0);
  });
});

describe("task repository", () => {
  async function seedTasks(userId: string) {
    const company = await createCompany(userId, "Acme");
    const job = await createJob(userId, { title: "Eng", companyId: company.id });

    const day = 24 * 60 * 60 * 1000;
    const at = (offsetDays: number, hour = 10) => {
      const d = new Date(Date.now() + offsetDays * day);
      d.setUTCHours(hour, 0, 0, 0);
      return d;
    };

    const base = {
      taskType: "FOLLOW_UP" as const,
      status: "OPEN" as const,
      priority: "MEDIUM" as const,
      jobId: job.id,
      contactId: null,
      emailId: null,
    };

    await taskRepo.createTask(userId, {
      ...base,
      title: "Overdue",
      description: null,
      dueAt: at(-3),
    });
    await taskRepo.createTask(userId, {
      ...base,
      title: "Today",
      description: null,
      dueAt: at(0),
    });
    await taskRepo.createTask(userId, {
      ...base,
      title: "Upcoming",
      description: null,
      dueAt: at(5),
    });
    await taskRepo.createTask(userId, {
      ...base,
      title: "No due date",
      description: null,
      dueAt: null,
    });
  }

  it("splits open tasks into overdue, today and upcoming", async () => {
    const user = await createUser();
    await seedTasks(user.id);

    const counts = await taskRepo.getTaskCounts(user.id);
    expect(counts.overdue).toBe(1);
    expect(counts.today).toBe(1);
    expect(counts.upcoming).toBe(1);
    expect(counts.all).toBe(4);
  });

  it("sorts undated tasks last", async () => {
    const user = await createUser();
    await seedTasks(user.id);

    const tasks = await taskRepo.listAllTasks(user.id);
    expect(tasks.at(-1)!.title).toBe("No due date");
  });

  it("stamps completedAt when completing and clears it on reopen", async () => {
    const user = await createUser();
    await seedTasks(user.id);
    const [task] = await taskRepo.listAllTasks(user.id);

    const done = await taskRepo.completeTask(user.id, task!.id, true);
    expect(done!.status).toBe("DONE");
    expect(done!.completedAt).toBeInstanceOf(Date);

    const reopened = await taskRepo.completeTask(user.id, task!.id, false);
    expect(reopened!.status).toBe("OPEN");
    expect(reopened!.completedAt).toBeNull();
  });

  it("will not complete another user's task", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await seedTasks(alice.id);
    const [task] = await taskRepo.listAllTasks(alice.id);

    expect(await taskRepo.completeTask(bob.id, task!.id, true)).toBeNull();
    const untouched = await db.task.findUnique({ where: { id: task!.id } });
    expect(untouched!.status).toBe("OPEN");
  });

  it("cascades task deletion when its job is deleted", async () => {
    const user = await createUser();
    await seedTasks(user.id);
    const job = await db.job.findFirst({ where: { userId: user.id } });
    await db.job.delete({ where: { id: job!.id } });
    expect(await db.task.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("note repository", () => {
  it("floats pinned notes to the top", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    const job = await createJob(user.id, { title: "Eng", companyId: company.id });

    await noteRepo.createNote(user.id, {
      body: "Older note",
      noteType: "GENERAL",
      isPinned: false,
      jobId: job.id,
      contactId: null,
    });
    await noteRepo.createNote(user.id, {
      body: "Pinned note",
      noteType: "INTERVIEW",
      isPinned: true,
      jobId: job.id,
      contactId: null,
    });

    const notes = await noteRepo.listNotesForJob(user.id, job.id);
    expect(notes[0]!.body).toBe("Pinned note");
  });

  it("will not read another user's note", async () => {
    const alice = await createUser();
    const bob = await createUser();

    const note = await noteRepo.createNote(alice.id, {
      body: "Private",
      noteType: "GENERAL",
      isPinned: false,
      jobId: null,
      contactId: null,
    });

    expect(await noteRepo.getNoteById(bob.id, note.id)).toBeNull();
  });
});

describe("email repository", () => {
  it("threads an inbound reply onto its outbound parent via In-Reply-To", async () => {
    const user = await createUser();
    const company = await createCompany(user.id, "Acme");
    const job = await createJob(user.id, { title: "Eng", companyId: company.id });
    const contact = await contactRepo.createContact(user.id, {
      name: "Dana",
      email: "dana@example.com",
      phone: null,
      linkedinUrl: null,
      title: null,
      companyId: company.id,
      contactType: "RECRUITER",
      relationship: "WEAK",
      lastContactedAt: null,
      notes: null,
      tags: [],
    });

    const outbound = await emailRepo.createEmail(user.id, {
      contactId: contact.id,
      jobId: job.id,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "SENT",
      toEmail: "dana@example.com",
      toName: "Dana",
      fromEmail: "me@example.com",
      subject: "Staff Engineer role at Acme",
      body: "Hi Dana",
      scheduledAt: null,
    });
    await emailRepo.updateEmail(user.id, outbound.id, {
      messageId: "<abc@example.com>",
    });

    const parent = await emailRepo.findThreadParent(user.id, {
      inReplyTo: "<abc@example.com>",
    });
    expect(parent?.id).toBe(outbound.id);
    expect(parent?.contactId).toBe(contact.id);
  });

  it("falls back to recipient plus normalised subject", async () => {
    const user = await createUser();
    const outbound = await emailRepo.createEmail(user.id, {
      contactId: null,
      jobId: null,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "SENT",
      toEmail: "dana@example.com",
      toName: null,
      fromEmail: "me@example.com",
      subject: "Staff Engineer role",
      body: "",
      scheduledAt: null,
    });

    const parent = await emailRepo.findThreadParent(user.id, {
      toEmail: "dana@example.com",
      subject: "Re: Staff Engineer role",
    });
    expect(parent?.id).toBe(outbound.id);
  });

  it("finds nothing when no message matches", async () => {
    const user = await createUser();
    expect(
      await emailRepo.findThreadParent(user.id, {
        toEmail: "nobody@example.com",
        subject: "Hello",
      }),
    ).toBeNull();
  });

  it("records delivery attempts", async () => {
    const user = await createUser();
    const email = await emailRepo.createEmail(user.id, {
      contactId: null,
      jobId: null,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "DRAFT",
      toEmail: "dana@example.com",
      toName: null,
      fromEmail: null,
      subject: "Hi",
      body: "",
      scheduledAt: null,
    });

    await emailRepo.recordDelivery(user.id, {
      emailId: email.id,
      attempt: 1,
      status: "FAILED",
      provider: "smtp",
      errorCode: "ECONNREFUSED",
      errorMessage: "Connection refused",
    });

    const deliveries = await emailRepo.listDeliveries(user.id, email.id);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe("FAILED");
  });

  it("does not list another user's messages", async () => {
    const alice = await createUser();
    const bob = await createUser();

    await emailRepo.createEmail(alice.id, {
      contactId: null,
      jobId: null,
      templateId: null,
      direction: "OUTBOUND",
      category: "COLD_OUTREACH",
      status: "DRAFT",
      toEmail: "secret@example.com",
      toName: null,
      fromEmail: null,
      subject: "Confidential",
      body: "",
      scheduledAt: null,
    });

    expect((await emailRepo.listEmails(bob.id)).total).toBe(0);
  });
});

describe("global search", () => {
  it("returns matches across entity types, scoped to the caller", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const company = await createCompany(alice.id, "Globex");

    await createJob(alice.id, { title: "Globex Engineer", companyId: company.id });
    await contactRepo.createContact(alice.id, {
      name: "Globex Recruiter",
      email: "r@globex.com",
      phone: null,
      linkedinUrl: null,
      title: null,
      companyId: company.id,
      contactType: "RECRUITER",
      relationship: "WEAK",
      lastContactedAt: null,
      notes: null,
      tags: [],
    });
    const results = await activityRepo.globalSearch(alice.id, "globex");
    expect(results.jobs.length).toBeGreaterThan(0);
    expect(results.contacts.length).toBeGreaterThan(0);

    // The same query must return nothing for a different account.
    const bobResults = await activityRepo.globalSearch(bob.id, "globex");
    expect(bobResults.jobs).toHaveLength(0);
    expect(bobResults.contacts).toHaveLength(0);
  });

  it("returns empty results for a blank query", async () => {
    const user = await createUser();
    expect((await activityRepo.globalSearch(user.id, "   ")).jobs).toEqual([]);
  });
});

describe("resume versions", () => {
  it("keeps exactly one default per user", async () => {
    const user = await createUser();
    const a = await activityRepo.createResumeVersion(user.id, {
      label: "General",
      fileUrl: null,
      summary: null,
    });
    const b = await activityRepo.createResumeVersion(user.id, {
      label: "Backend",
      fileUrl: null,
      summary: null,
    });

    await activityRepo.setDefaultResume(user.id, a.id);
    await activityRepo.setDefaultResume(user.id, b.id);

    const versions = await activityRepo.listResumeVersions(user.id);
    expect(versions.filter((v) => v.isDefault)).toHaveLength(1);
    expect(versions.find((v) => v.isDefault)!.id).toBe(b.id);
  });
});
