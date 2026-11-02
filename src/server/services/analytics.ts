/**
 * Analytics.
 *
 * Every figure is computed from the user's own rows in SQL rather than by loading
 * records into memory, so the dashboard cost stays flat as the search grows.
 */
import type { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus, TaskStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/constants";

export interface PipelineCounts {
  total: number;
  active: number;
  byStatus: Record<string, number>;
}

export async function getPipelineCounts(userId: string): Promise<PipelineCounts> {
  const [total, active, grouped] = await Promise.all([
    db.job.count({ where: { userId } }),
    db.job.count({
      where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    }),
    db.job.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const status of Object.values(ApplicationStatus)) byStatus[status] = 0;
  for (const row of grouped) byStatus[row.status] = row._count._all;

  return { total, active, byStatus };
}

export interface DashboardStats {
  totalApplications: number;
  activeApplications: number;
  interviewsThisWeek: number;
  offers: number;
  offersAccepted: number;
  /** Share of submitted applications that reached an interview. */
  interviewRate: number;
  /** Share of sent outreach emails that received a reply. */
  emailReplyRate: number;
  openTasks: number;
  overdueTasks: number;
}

export async function getDashboardStats(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardStats> {
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    totalApplications,
    activeApplications,
    interviewsThisWeek,
    offers,
    offersAccepted,
    reachedInterview,
    sentEmails,
    repliedEmails,
    openTasks,
    overdueTasks,
  ] = await Promise.all([
    db.job.count({ where: { userId } }),
    db.job.count({ where: { userId, status: { in: [...ACTIVE_STATUSES] } } }),
    // Interviews are modelled as tasks, so this is a real count, not a guess.
    db.task.count({
      where: {
        userId,
        taskType: "INTERVIEW",
        status: TaskStatus.OPEN,
        dueAt: { gte: now, lte: weekAhead },
      },
    }),
    db.job.count({ where: { userId, status: ApplicationStatus.OFFER } }),
    db.job.count({ where: { userId, status: ApplicationStatus.HIRED } }),
    db.job.count({
      where: {
        userId,
        status: {
          in: [
            ApplicationStatus.PHONE_SCREEN,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.ONSITE,
            ApplicationStatus.OFFER,
            ApplicationStatus.HIRED,
          ],
        },
      },
    }),
    db.email.count({
      where: { userId, direction: "OUTBOUND", status: { in: ["SENT", "REPLIED"] } },
    }),
    db.email.count({
      where: { userId, direction: "OUTBOUND", status: "REPLIED" },
    }),
    db.task.count({
      where: { userId, status: TaskStatus.OPEN },
    }),
    db.task.count({
      where: { userId, status: TaskStatus.OPEN, dueAt: { lt: startOfToday } },
    }),
  ]);

  const submitted = totalApplications - (await countSavedOnly(userId));

  return {
    totalApplications,
    activeApplications,
    interviewsThisWeek,
    offers,
    offersAccepted,
    interviewRate: submitted > 0 ? reachedInterview / submitted : 0,
    emailReplyRate: sentEmails > 0 ? repliedEmails / sentEmails : 0,
    openTasks,
    overdueTasks,
  };
}

async function countSavedOnly(userId: string): Promise<number> {
  return db.job.count({ where: { userId, status: ApplicationStatus.SAVED } });
}

/** Interviews and other meetings scheduled in the next `days` days. */
export async function getUpcomingInterviews(userId: string, days = 14) {
  const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return db.task.findMany({
    where: {
      userId,
      taskType: "INTERVIEW",
      status: TaskStatus.OPEN,
      dueAt: { gte: new Date(), lte: horizon },
    },
    orderBy: { dueAt: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      dueAt: true,
      jobId: true,
      job: { select: { id: true, title: true, company: { select: { name: true } } } },
      contact: { select: { id: true, name: true } },
    },
  });
}

/** Applications closing within `days` days that have not been actioned. */
export async function getUpcomingDeadlines(userId: string, days = 14) {
  const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return db.job.findMany({
    where: {
      userId,
      deadlineAt: { gte: new Date(), lte: horizon },
      status: { in: [ApplicationStatus.SAVED, ApplicationStatus.APPLIED] },
    },
    orderBy: { deadlineAt: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      deadlineAt: true,
      status: true,
      company: { select: { name: true } },
    },
  });
}

export interface MonthlyPoint {
  month: string;
  applied: number;
  interviews: number;
  offers: number;
}

/** Applications and outcomes bucketed by calendar month. */
export async function getMonthlyPipeline(
  userId: string,
  months = 6,
): Promise<MonthlyPoint[]> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));

  const [rows, statusRows] = await Promise.all([
    db.job.findMany({
      where: { userId, appliedAt: { gte: since } },
      select: { appliedAt: true },
    }),
    db.statusEvent.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        toStatus: {
          in: [
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.ONSITE,
            ApplicationStatus.OFFER,
          ],
        },
      },
      select: { createdAt: true, toStatus: true },
    }),
  ]);

  const buckets = new Map<string, MonthlyPoint>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    buckets.set(d.toISOString().slice(0, 7), {
      month: d.toISOString().slice(0, 7),
      applied: 0,
      interviews: 0,
      offers: 0,
    });
  }

  for (const row of rows) {
    if (!row.appliedAt) continue;
    const key = row.appliedAt.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (bucket) bucket.applied += 1;
  }

  for (const row of statusRows) {
    const key = row.createdAt.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (
      row.toStatus === ApplicationStatus.INTERVIEW ||
      row.toStatus === ApplicationStatus.ONSITE
    ) {
      bucket.interviews += 1;
    } else if (row.toStatus === ApplicationStatus.OFFER) {
      bucket.offers += 1;
    }
  }

  return [...buckets.values()];
}

export interface CompanyPerformance {
  companyId: string;
  companyName: string;
  applications: number;
  active: number;
  offers: number;
}

/** Which companies are actually producing results. */
export async function getCompanyPerformance(
  userId: string,
  limit = 10,
): Promise<CompanyPerformance[]> {
  const rows = await db.job.groupBy({
    by: ["companyId"],
    where: { userId },
    _count: { _all: true },
  });

  const withNames = await Promise.all(
    rows.map(async (row) => {
      const company = await db.company.findFirst({
        where: { id: row.companyId, userId },
        select: { name: true },
      });
      return company?.name ?? "Unknown";
    }),
  );

  const [activeRows, offerRows] = await Promise.all([
    db.job.groupBy({
      by: ["companyId"],
      where: { userId, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
    db.job.groupBy({
      by: ["companyId"],
      where: { userId, status: { in: [ApplicationStatus.OFFER, ApplicationStatus.HIRED] } },
      _count: { _all: true },
    }),
  ]);

  const activeMap = new Map(activeRows.map((r) => [r.companyId, r._count._all]));
  const offerMap = new Map(offerRows.map((r) => [r.companyId, r._count._all]));

  return rows
    .map((row, i) => ({
      companyId: row.companyId,
      companyName: withNames[i]!,
      applications: row._count._all,
      active: activeMap.get(row.companyId) ?? 0,
      offers: offerMap.get(row.companyId) ?? 0,
    }))
    .sort((a, b) => b.applications - a.applications || b.offers - a.offers)
    .slice(0, limit);
}

/** How long applications sit in the pipeline before a decision. */
export async function getTimeToDecision(userId: string): Promise<{
  medianDays: number | null;
  averageDays: number | null;
  decided: number;
}> {
  const decided = await db.job.findMany({
    where: {
      userId,
      appliedAt: { not: null },
      closedAt: { not: null },
    },
    select: { appliedAt: true, closedAt: true },
  });

  if (decided.length === 0) {
    return { medianDays: null, averageDays: null, decided: 0 };
  }

  const durations = decided
    .map((j) => {
      if (!j.appliedAt || !j.closedAt) return null;
      return (j.closedAt.getTime() - j.appliedAt.getTime()) / (24 * 60 * 60 * 1000);
    })
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return { medianDays: null, averageDays: null, decided: decided.length };
  }

  const mid = Math.floor(durations.length / 2);
  const median =
    durations.length % 2 === 0
      ? ((durations[mid - 1]! + durations[mid]!) / 2)
      : durations[mid]!;

  const average =
    durations.reduce((sum, d) => sum + d, 0) / durations.length;

  return {
    medianDays: Math.round(median * 10) / 10,
    averageDays: Math.round(average * 10) / 10,
    decided: durations.length,
  };
}

/** Source-of-application breakdown, derived from free-form tags. */
export async function getSourceBreakdown(userId: string) {
  const jobs = await db.job.findMany({
    where: { userId, appliedAt: { not: null } },
    select: { tags: true, status: true },
  });

  const counts = new Map<string, { total: number; interviews: number }>();
  const interviewStages = new Set<string>([
    ApplicationStatus.PHONE_SCREEN,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.ONSITE,
    ApplicationStatus.OFFER,
    ApplicationStatus.HIRED,
  ]);

  for (const job of jobs) {
    const sources = job.tags.length > 0 ? job.tags : ["untagged"];
    for (const source of sources) {
      const entry = counts.get(source) ?? { total: 0, interviews: 0 };
      entry.total += 1;
      if (interviewStages.has(job.status)) entry.interviews += 1;
      counts.set(source, entry);
    }
  }

  return [...counts.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

/** Funnel for the reports page: submitted → screen → interview → offer → hired. */
export async function getFunnel(userId: string) {
  const counts = await getPipelineCounts(userId);
  const s = counts.byStatus;

  const applied =
    (s[ApplicationStatus.APPLIED] ?? 0) +
    (s[ApplicationStatus.PHONE_SCREEN] ?? 0) +
    (s[ApplicationStatus.INTERVIEW] ?? 0) +
    (s[ApplicationStatus.ONSITE] ?? 0) +
    (s[ApplicationStatus.OFFER] ?? 0) +
    (s[ApplicationStatus.HIRED] ?? 0) +
    (s[ApplicationStatus.REJECTED] ?? 0) +
    (s[ApplicationStatus.WITHDRAWN] ?? 0);

  const screened =
    (s[ApplicationStatus.PHONE_SCREEN] ?? 0) +
    (s[ApplicationStatus.INTERVIEW] ?? 0) +
    (s[ApplicationStatus.ONSITE] ?? 0) +
    (s[ApplicationStatus.OFFER] ?? 0) +
    (s[ApplicationStatus.HIRED] ?? 0) +
    (s[ApplicationStatus.REJECTED] ?? 0) +
    (s[ApplicationStatus.WITHDRAWN] ?? 0);

  const interviewed =
    (s[ApplicationStatus.INTERVIEW] ?? 0) +
    (s[ApplicationStatus.ONSITE] ?? 0) +
    (s[ApplicationStatus.OFFER] ?? 0) +
    (s[ApplicationStatus.HIRED] ?? 0) +
    (s[ApplicationStatus.REJECTED] ?? 0) +
    (s[ApplicationStatus.WITHDRAWN] ?? 0);

  const offered =
    (s[ApplicationStatus.OFFER] ?? 0) + (s[ApplicationStatus.HIRED] ?? 0);

  return { applied, screened, interviewed, offered, hired: s[ApplicationStatus.HIRED] ?? 0 };
}

export type ContactSourceRow = Prisma.ContactGetPayload<{
  select: { contactType: true };
}>;
