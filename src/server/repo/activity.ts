/**
 * Activity log, resume versions and global search.
 */
import type { Prisma } from "@/generated/prisma/client";
import { ActivityAction, ActivityEntity } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { normalisePaging, paginate, searchText, type Paginated } from "@/server/repo/shared";

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const activitySelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  summary: true,
  metadata: true,
  createdAt: true,
  jobId: true,
  contactId: true,
  emailId: true,
} satisfies Prisma.ActivityEventSelect;

export type ActivityItem = Prisma.ActivityEventGetPayload<{
  select: typeof activitySelect;
}>;

export interface LogActivityInput {
  action: ActivityAction;
  entityType: ActivityEntity;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  jobId?: string | null;
  contactId?: string | null;
  emailId?: string | null;
}

/**
 * Records an entry in the activity timeline.
 *
 * Failures are swallowed on purpose: an unwritable audit row must not roll back
 * or fail the user's actual edit.
 */
export async function logActivity(
  userId: string,
  input: LogActivityInput,
): Promise<void> {
  try {
    await db.activityEvent.create({
      data: {
        userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata,
        jobId: input.jobId ?? null,
        contactId: input.contactId ?? null,
        emailId: input.emailId ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log entry", error);
  }
}

export interface ActivityFilters {
  entityType?: ActivityEntity;
  entityId?: string;
  jobId?: string;
  contactId?: string;
  limit?: number;
}

export async function listActivity(
  userId: string,
  params: ActivityFilters & { page?: number; pageSize?: number } = {},
): Promise<Paginated<ActivityItem>> {
  const { page, pageSize, skip, take } = normalisePaging({
    ...params,
    pageSize: params.pageSize ?? params.limit ?? 25,
  });

  const where: Prisma.ActivityEventWhereInput = {
    userId,
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(params.jobId ? { jobId: params.jobId } : {}),
    ...(params.contactId ? { contactId: params.contactId } : {}),
  };

  const [items, total] = await Promise.all([
    db.activityEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: activitySelect,
      skip,
      take,
    }),
    db.activityEvent.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

// ---------------------------------------------------------------------------
// Resume versions
// ---------------------------------------------------------------------------

export const resumeSelect = {
  id: true,
  label: true,
  fileUrl: true,
  summary: true,
  isDefault: true,
  createdAt: true,
  _count: { select: { jobs: true } },
} satisfies Prisma.ResumeVersionSelect;

export type ResumeItem = Prisma.ResumeVersionGetPayload<{
  select: typeof resumeSelect;
}>;

export async function listResumeVersions(userId: string): Promise<ResumeItem[]> {
  return db.resumeVersion.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: resumeSelect,
  });
}

export async function getResumeVersion(
  userId: string,
  id: string,
): Promise<ResumeItem | null> {
  return db.resumeVersion.findFirst({
    where: { id, userId },
    select: resumeSelect,
  });
}

/**
 * Setting a default clears any previous default in the same transaction, so the
 * "one default resume" invariant holds under concurrent requests.
 */
export async function setDefaultResume(
  userId: string,
  id: string,
): Promise<ResumeItem | null> {
  return db.$transaction(async (tx) => {
    const existing = await tx.resumeVersion.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return null;

    await tx.resumeVersion.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return tx.resumeVersion.update({
      where: { id },
      data: { isDefault: true },
      select: resumeSelect,
    });
  });
}

export async function createResumeVersion(
  userId: string,
  data: { label: string; fileUrl: string | null; summary: string | null },
): Promise<ResumeItem> {
  return db.resumeVersion.create({
    data: { userId, ...data },
    select: resumeSelect,
  });
}

export async function updateResumeVersion(
  userId: string,
  id: string,
  data: { label?: string; fileUrl?: string | null; summary?: string | null },
): Promise<ResumeItem | null> {
  const existing = await db.resumeVersion.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return db.resumeVersion.update({ where: { id }, data, select: resumeSelect });
}

export async function deleteResumeVersion(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await db.resumeVersion.deleteMany({
    where: { id, userId },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export interface SearchResults {
  jobs: SearchHit[];
  contacts: SearchHit[];
  companies: SearchHit[];
  notes: SearchHit[];
  emails: SearchHit[];
  tasks: SearchHit[];
}

/** Uniform shape so the header combobox can render every group identically. */
export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  jobs: [],
  contacts: [],
  companies: [],
  notes: [],
  emails: [],
  tasks: [],
};

/**
 * Searches across every entity the user owns.
 *
 * Each branch is independently scoped by `userId`, so a global search can never
 * surface another account's rows even if it matches the same text.
 */
export async function globalSearch(
  userId: string,
  query: string,
  perEntityLimit = 5,
): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return EMPTY_SEARCH_RESULTS;

  const [jobs, contacts, companies, notes, emails, tasks] = await Promise.all([
    db.job.findMany({
      where: andSearch<Prisma.JobWhereInput>(userId, searchText<Prisma.JobWhereInput>(q, ["title", "notes", "company.name"])),
      take: perEntityLimit,
      select: {
        id: true,
        title: true,
        status: true,
        company: { select: { name: true } },
      },
    }),
    db.contact.findMany({
      where: andSearch<Prisma.ContactWhereInput>(userId, searchText<Prisma.ContactWhereInput>(q, ["name", "email", "title", "company.name"])),
      take: perEntityLimit,
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        contactType: true,
        company: { select: { name: true } },
      },
    }),
    db.company.findMany({
      where: andSearch<Prisma.CompanyWhereInput>(userId, searchText<Prisma.CompanyWhereInput>(q, ["name", "industry", "location"])),
      take: perEntityLimit,
      select: { id: true, name: true, industry: true, location: true },
    }),
    db.note.findMany({
      where: andSearch<Prisma.NoteWhereInput>(userId, searchText<Prisma.NoteWhereInput>(q, ["body"])),
      take: perEntityLimit,
      select: { id: true, body: true, noteType: true, jobId: true, contactId: true },
    }),
    db.email.findMany({
      where: andSearch<Prisma.EmailWhereInput>(userId, searchText<Prisma.EmailWhereInput>(q, ["subject", "body", "toEmail", "contact.name"])),
      take: perEntityLimit,
      select: { id: true, subject: true, status: true, sentAt: true, contact: { select: { name: true } } },
    }),
    db.task.findMany({
      where: andSearch<Prisma.TaskWhereInput>(userId, searchText<Prisma.TaskWhereInput>(q, ["title", "description"])),
      take: perEntityLimit,
      select: { id: true, title: true, status: true, dueAt: true },
    }),
  ]);

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      subtitle: j.company.name,
      href: `/jobs/${j.id}`,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: [c.title, c.company?.name].filter(Boolean).join(" · ") || c.email || "",
      href: `/contacts/${c.id}`,
    })),
    companies: companies.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: [c.industry, c.location].filter(Boolean).join(" · "),
      href: `/companies/${c.id}`,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.body.length > 70 ? `${n.body.slice(0, 70)}…` : n.body,
      subtitle: n.jobId ? "Application note" : n.contactId ? "Contact note" : "Note",
      href: n.jobId
        ? `/jobs/${n.jobId}`
        : n.contactId
          ? `/contacts/${n.contactId}`
          : "/notes",
    })),
    emails: emails.map((e) => ({
      id: e.id,
      title: e.subject || "(no subject)",
      subtitle: e.contact?.name ?? e.status,
      href: "/emails",
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.dueAt ? `Due ${t.dueAt.toISOString().slice(0, 10)}` : t.status,
      href: "/tasks",
    })),
  };
}

/** `andSearch` merges the tenancy clause with an optional free-text clause. */
function andSearch<T extends object>(
  userId: string,
  text: T | undefined,
): T {
  if (!text) return { userId } as T;
  return { AND: [{ userId }, text] } as unknown as T;
}
