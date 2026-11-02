/**
 * Shared fixtures for integration tests.
 */
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface TestUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

let counter = 0;

/** A unique-per-call user so parallel specs never collide on the unique email. */
export async function createUser(
  overrides: Partial<Omit<TestUser, "passwordHash">> & { password?: string } = {},
): Promise<TestUser> {
  counter += 1;
  const suffix = `${process.pid}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
  const email = overrides.email ?? `user-${suffix}@example.com`;

  return db.user.create({
    data: {
      email,
      name: overrides.name ?? "Test User",
      passwordHash: await hashPassword(overrides.password ?? "correct horse battery"),
    },
  });
}

export async function createCompany(userId: string, name: string, extra: Record<string, unknown> = {}) {
  return db.company.create({
    data: {
      userId,
      name,
      websiteUrl: null,
      linkedinUrl: null,
      industry: null,
      location: null,
      size: null,
      notes: null,
      tags: [],
      ...extra,
    },
  });
}

export async function createJob(
  userId: string,
  data: { title: string; companyId: string; [key: string]: unknown },
) {
  return db.job.create({
    data: {
      userId,
      ...data,
      title: data.title,
      companyId: data.companyId,
    },
  });
}

/**
 * Empties every application table while leaving the migration history intact.
 * `TRUNCATE ... CASCADE` is far faster than deleting row by row and guarantees
 * no FK is left dangling.
 */
export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActivityEvent",
      "EmailDelivery",
      "Email",
      "EmailTemplate",
      "Note",
      "Task",
      "StatusEvent",
      "Job",
      "Contact",
      "Company",
      "ResumeVersion",
      "Session",
      "User"
    RESTART IDENTITY CASCADE
  `);
}
