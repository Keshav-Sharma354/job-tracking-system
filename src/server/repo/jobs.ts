/**
 * Job (application) repository.
 *
 * Every function takes `userId` and includes it in the WHERE clause. Reading or
 * mutating a job without knowing its owner is therefore not expressible — a
 * cross-tenant id resolves to `null` rather than to someone else's data.
 */
import type { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  andWhere,
  jobOrderBy,
  normalisePaging,
  paginate,
  searchText,
  type JobFilters,
  type Paginated,
} from "@/server/repo/shared";

export const jobListSelect = {
  id: true,
  title: true,
  url: true,
  location: true,
  status: true,
  priority: true,
  workMode: true,
  employmentType: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  appliedAt: true,
  deadlineAt: true,
  createdAt: true,
  updatedAt: true,
  tags: true,
  companyId: true,
  company: { select: { id: true, name: true, websiteUrl: true } },
  resumeVersion: { select: { id: true, label: true } },
  referralContact: { select: { id: true, name: true } },
} satisfies Prisma.JobSelect;

export type JobListItem = Prisma.JobGetPayload<{ select: typeof jobListSelect }>;

export const jobDetailSelect = {
  ...jobListSelect,
  notes: true,
  closedAt: true,
  company: { select: { id: true, name: true, websiteUrl: true, notes: true } },
  referralContact: {
    select: { id: true, name: true, email: true, contactType: true },
  },
  _count: {
    select: { noteRecords: true, emails: true, tasks: true, statusEvents: true },
  },
} satisfies Prisma.JobSelect;

export type JobDetail = Prisma.JobGetPayload<{ select: typeof jobDetailSelect }>;

function buildWhere(userId: string, filters: JobFilters): Prisma.JobWhereInput {
  const clauses: Prisma.JobWhereInput[] = [{ userId }];

  if (filters.statuses && filters.statuses.length > 0) {
    clauses.push({ status: { in: filters.statuses } });
  }

  if (filters.companyId) {
    clauses.push({ companyId: filters.companyId });
  }

  if (filters.priority) {
    clauses.push({ priority: filters.priority });
  }

  if (filters.tags && filters.tags.length > 0) {
    clauses.push({ tags: { hasSome: filters.tags } });
  }

  if (filters.hasDeadline === true) {
    clauses.push({ deadlineAt: { not: null } });
  }

  if (filters.dueWithinDays !== undefined) {
    const now = new Date();
    const horizon = new Date(
      now.getTime() + filters.dueWithinDays * 24 * 60 * 60 * 1000,
    );
    clauses.push({
      deadlineAt: { gte: startOfDay(now), lte: endOfDay(horizon) },
    });
  }

  const text = searchText<Prisma.JobWhereInput>(filters.q ?? "", [
    "title",
    "location",
    "notes",
    "company.name",
  ]);

  return andWhere<Prisma.JobWhereInput>({ userId }, ...clauses, text);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

export interface ListJobsParams extends JobFilters {
  page?: number;
  pageSize?: number;
}

export async function listJobs(
  userId: string,
  params: ListJobsParams = {},
): Promise<Paginated<JobListItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);
  const orderBy = jobOrderBy(params.sort, params.direction);

  const [items, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy,
      select: jobListSelect,
      skip,
      take,
    }),
    db.job.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

/** Every matching job, unpaginated. Used by the Kanban board and CSV export. */
export async function listAllJobs(
  userId: string,
  filters: JobFilters = {},
): Promise<JobListItem[]> {
  return db.job.findMany({
    where: buildWhere(userId, filters),
    orderBy: jobOrderBy(filters.sort, filters.direction),
    select: jobListSelect,
  });
}

export async function getJobById(
  userId: string,
  jobId: string,
): Promise<JobDetail | null> {
  return db.job.findFirst({
    where: { id: jobId, userId },
    select: jobDetailSelect,
  });
}

export interface CreateJobData {
  companyId: string;
  title: string;
  url: string | null;
  location: string | null;
  employmentType: Prisma.JobCreateInput["employmentType"];
  workMode: Prisma.JobCreateInput["workMode"];
  status: ApplicationStatus;
  priority: Prisma.JobCreateInput["priority"];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  appliedAt: Date | null;
  deadlineAt: Date | null;
  resumeVersionId: string | null;
  referralContactId: string | null;
  notes: string | null;
  tags: string[];
}

export async function createJob(
  userId: string,
  data: CreateJobData,
): Promise<JobDetail> {
  const job = await db.job.create({
    data: {
      userId,
      companyId: data.companyId,
      title: data.title,
      url: data.url,
      location: data.location,
      employmentType: data.employmentType,
      workMode: data.workMode,
      status: data.status,
      priority: data.priority,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      salaryCurrency: data.salaryCurrency,
      salaryPeriod: data.salaryPeriod,
      // `appliedAt` is the single source of truth for "have I applied", so keep
      // it consistent with the status the first time an application is recorded.
      appliedAt:
        data.appliedAt ??
        (data.status !== ApplicationStatus.SAVED ? new Date() : null),
      deadlineAt: data.deadlineAt,
      resumeVersionId: data.resumeVersionId,
      referralContactId: data.referralContactId,
      notes: data.notes,
      tags: data.tags,
    },
    select: jobDetailSelect,
  });

  if (job.status !== ApplicationStatus.SAVED) {
    await db.statusEvent.create({
      data: { userId, jobId: job.id, toStatus: job.status },
    });
  }

  return job;
}

export type UpdateJobData = Partial<CreateJobData>;

export async function updateJob(
  userId: string,
  jobId: string,
  data: UpdateJobData,
): Promise<JobDetail | null> {
  const existing = await db.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  // A nullable FK is cleared with `null`; Prisma needs the field listed to unset.
  const payload: Prisma.JobUpdateInput = {
    company: data.companyId ? { connect: { id: data.companyId } } : undefined,
    resumeVersion:
      data.resumeVersionId === undefined
        ? undefined
        : data.resumeVersionId
          ? { connect: { id: data.resumeVersionId } }
          : { disconnect: true },
    referralContact:
      data.referralContactId === undefined
        ? undefined
        : data.referralContactId
          ? { connect: { id: data.referralContactId } }
          : { disconnect: true },
  };

  const scalars: (keyof CreateJobData)[] = [
    "title",
    "url",
    "location",
    "employmentType",
    "workMode",
    "priority",
    "salaryMin",
    "salaryMax",
    "salaryCurrency",
    "salaryPeriod",
    "appliedAt",
    "deadlineAt",
    "notes",
    "tags",
  ];

  for (const key of scalars) {
    if (data[key] !== undefined) {
      (payload as Record<string, unknown>)[key] = data[key];
    }
  }

  return db.job.update({ where: { id: jobId }, data: payload, select: jobDetailSelect });
}

/**
 * Moves a job between pipeline stages, recording the transition atomically with
 * the update so the history can never drift from the current status.
 */
export async function changeJobStatus(
  userId: string,
  jobId: string,
  status: ApplicationStatus,
  note?: string | null,
): Promise<JobDetail | null> {
  return db.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id: jobId, userId },
      select: { id: true, status: true },
    });
    if (!existing) return null;

    const changed = existing.status !== status;
    const now = new Date();

    const job = await tx.job.update({
      where: { id: jobId },
      data: {
        status,
        // First time out of SAVED counts as the application date.
        appliedAt:
          existing.status === ApplicationStatus.SAVED &&
          status !== ApplicationStatus.SAVED
            ? now
            : undefined,
      },
      select: jobDetailSelect,
    });

    if (changed) {
      await tx.statusEvent.create({
        data: {
          userId,
          jobId,
          fromStatus: existing.status,
          toStatus: status,
          note: note ?? null,
        },
      });
    }

    return job;
  });
}

export async function deleteJob(userId: string, jobId: string): Promise<boolean> {  const { count } = await db.job.deleteMany({ where: { id: jobId, userId } });
  return count > 0;
}

export async function listStatusEvents(userId: string, jobId: string) {
  return db.statusEvent.findMany({
    where: { userId, jobId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
    },
  });
}

/**
 * Full records for export.
 *
 * Separate from `listAllJobs` because it pulls the `notes` column, which can be
 * several kilobytes per row and would make the board and list views wasteful.
 */
export async function listJobsForExport(
  userId: string,
): Promise<
  Array<Prisma.JobGetPayload<{ select: typeof jobListSelect }> & { notes: string | null }>
> {
  return db.job.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
    select: { ...jobListSelect, notes: true },
  });
}

/** Counts per status for the Kanban column headers, in one round trip. */export async function countByStatus(
  userId: string,
): Promise<Record<string, number>> {
  const grouped = await db.job.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  const result: Record<string, number> = {};
  for (const row of grouped) {
    result[row.status] = row._count._all;
  }
  return result;
}
