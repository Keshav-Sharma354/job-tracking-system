/**
 * Job (application) service.
 *
 * Services own the business rules the repositories deliberately do not:
 * resolving a company by name when creating an application, verifying that
 * foreign keys belong to the same user, writing the activity timeline, and
 * creating the follow-up task that a status change implies.
 *
 * Every function takes `userId` as its first argument and is directly testable
 * without a request context.
 */
import { db, isUniqueConstraintError } from "@/lib/db";
import { ActivityAction, ActivityEntity, ApplicationStatus } from "@/generated/prisma/enums";
import { FOLLOW_UP_SLA_DAYS, STATUS_META, isTerminalStatus } from "@/lib/constants";
import type { JobData } from "@/lib/validation/schemas";
import * as jobRepo from "@/server/repo/jobs";
import * as companyRepo from "@/server/repo/companies";
import * as contactRepo from "@/server/repo/contacts";
import * as taskRepo from "@/server/repo/tasks";
import { logActivity } from "@/server/repo/activity";
import { fail, fieldError, internal, notFound, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { JobDetail } from "@/server/repo/jobs";

export type { JobDetail };

/**
 * Resolves the target company for a new application.
 *
 * An existing company id wins; otherwise a company with that name is reused or
 * created. This is what lets a user type "Stripe" in a form and get one company
 * row rather than a new one per application.
 */
async function resolveCompanyId(
  userId: string,
  companyId: string | null,
  companyName: string | null,
): Promise<string | { error: string }> {
  if (companyId) {
    const existing = await companyRepo.getCompanyById(userId, companyId);
    if (!existing) return { error: "The selected company no longer exists" };
    return existing.id;
  }

  const name = companyName?.trim();
  if (!name) return { error: "Choose a company or enter a new company name" };

  const existing = await companyRepo.findCompanyByName(userId, name);
  if (existing) return existing.id;

  try {
    const created = await companyRepo.createCompany(userId, {
      name,
      websiteUrl: null,
      linkedinUrl: null,
      industry: null,
      location: null,
      size: null,
      notes: null,
      tags: [],
    });
    await logActivity(userId, {
      action: ActivityAction.CREATED,
      entityType: ActivityEntity.COMPANY,
      entityId: created.id,
      summary: `Added company ${created.name}`,
    });
    return created.id;
  } catch (error) {
    // Another tab may have created the same company concurrently.
    if (isUniqueConstraintError(error)) {
      const raced = await companyRepo.findCompanyByName(userId, name);
      if (raced) return raced.id;
    }
    return { error: "Could not create the company" };
  }
}

export async function createApplication(
  userId: string,
  input: JobData,
): Promise<ActionResult<JobDetail>> {
  const resolved = await resolveCompanyId(
    userId,
    input.companyId,
    input.companyName,
  );
  if (typeof resolved !== "string") {
    return fieldError("companyName", resolved.error);
  }

  if (
    input.referralContactId &&
    !(await contactRepo.getContactById(userId, input.referralContactId))
  ) {
    return fieldError("referralContactId", "That contact no longer exists");
  }

  if (
    input.resumeVersionId &&
    !(await db.resumeVersion.findFirst({
      where: { id: input.resumeVersionId, userId },
      select: { id: true },
    }))
  ) {
    return fieldError("resumeVersionId", "That resume version no longer exists");
  }

  try {
    const job = await jobRepo.createJob(userId, {
      companyId: resolved,
      title: input.title,
      url: input.url,
      location: input.location,
      employmentType: input.employmentType,
      workMode: input.workMode,
      status: input.status,
      priority: input.priority,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency ?? "USD",
      salaryPeriod: input.salaryPeriod ?? "YEAR",
      appliedAt: input.appliedAt,
      deadlineAt: input.deadlineAt,
      resumeVersionId: input.resumeVersionId,
      referralContactId: input.referralContactId,
      notes: input.notes,
      tags: input.tags,
    });

    await logActivity(userId, {
      action: ActivityAction.CREATED,
      entityType: ActivityEntity.JOB,
      entityId: job.id,
      jobId: job.id,
      summary: `Added ${job.title} at ${job.company.name}`,
    });

    // Creating a record already in an active stage counts as applying, so it
    // needs the same follow-up a status move would create.
    if (job.status !== ApplicationStatus.SAVED) {
      await scheduleStatusFollowUp(userId, job, job.status);
    }

    return ok(job, `${job.title} added to your pipeline`);
  } catch (error) {
    console.error("createApplication failed", error);
    return internal("Could not save this application");
  }
}

export async function updateApplication(
  userId: string,
  jobId: string,
  input: JobData,
): Promise<ActionResult<JobDetail>> {
  const existing = await jobRepo.getJobById(userId, jobId);
  if (!existing) return notFound("That application no longer exists");

  // A partial edit may omit the company entirely; fall back to the current one.
  const resolved =
    input.companyId === null && input.companyName === null
      ? existing.companyId
      : await resolveCompanyId(userId, input.companyId, input.companyName);

  if (typeof resolved !== "string") {
    return fieldError("companyName", resolved.error);
  }

  try {
    const job = await jobRepo.updateJob(userId, jobId, {
      companyId: resolved,
      title: input.title,
      url: input.url,
      location: input.location,
      employmentType: input.employmentType,
      workMode: input.workMode,
      priority: input.priority,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency ?? "USD",
      salaryPeriod: input.salaryPeriod ?? "YEAR",
      appliedAt: input.appliedAt,
      deadlineAt: input.deadlineAt,
      resumeVersionId: input.resumeVersionId,
      referralContactId: input.referralContactId,
      notes: input.notes,
      tags: input.tags,
    });

    if (!job) return notFound();

    await logActivity(userId, {
      action: ActivityAction.UPDATED,
      entityType: ActivityEntity.JOB,
      entityId: job.id,
      jobId: job.id,
      summary: `Updated ${job.title} at ${job.company.name}`,
    });

    return ok(job, "Application updated");
  } catch (error) {
    console.error("updateApplication failed", error);
    return internal("Could not save your changes");
  }
}

/**
 * Moves an application to a new stage and, unless the process is over, schedules
 * the follow-up that the move implies.
 */
export async function moveApplication(
  userId: string,
  jobId: string,
  status: ApplicationStatus,
  note?: string | null,
): Promise<ActionResult<JobDetail>> {
  const existing = await jobRepo.getJobById(userId, jobId);
  if (!existing) return notFound("That application no longer exists");

  if (existing.status === status) {
    return ok(existing, "No change");
  }

  const job = await jobRepo.changeJobStatus(userId, jobId, status, note);
  if (!job) return notFound();

  await logActivity(userId, {
    action: ActivityAction.STATUS_CHANGED,
    entityType: ActivityEntity.JOB,
    entityId: job.id,
    jobId: job.id,
    summary: `${job.title} at ${job.company.name}: ${existing.status} → ${status}`,
  });

  // Closing the application cancels anything still outstanding for it.
  if (isTerminalStatus(status)) {
    await db.task.updateMany({
      where: { userId, jobId, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
    return ok(job, `Moved to ${status}`);
  }

  await scheduleStatusFollowUp(userId, job, status);

  return ok(job, `Moved to ${status}`);
}

/** Days to wait before following up, by pipeline stage. `null` means no task. */
function followUpDelay(status: ApplicationStatus): number | null {
  switch (status) {
    case ApplicationStatus.APPLIED:
      return FOLLOW_UP_SLA_DAYS.APPLICATION_AFTER_APPLY;
    case ApplicationStatus.PHONE_SCREEN:
    case ApplicationStatus.INTERVIEW:
    case ApplicationStatus.ONSITE:
      return FOLLOW_UP_SLA_DAYS.AFTER_INTERVIEW;
    case ApplicationStatus.OFFER:
      return 2;
    default:
      return null;
  }
}

/**
 * Creates the follow-up reminder that entering an active stage implies.
 *
 * No-ops when there is no delay configured, or when an open follow-up already
 * exists, so repeated edits do not pile up duplicate reminders.
 */
async function scheduleStatusFollowUp(
  userId: string,
  job: JobDetail,
  status: ApplicationStatus,
): Promise<void> {
  const dueInDays = followUpDelay(status);
  if (dueInDays === null) return;

  const existing = await db.task.findFirst({
    where: { userId, jobId: job.id, status: "OPEN", taskType: "FOLLOW_UP" },
    select: { id: true },
  });
  if (existing) return;

  const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
  // Set 09:00 UTC on the due day so "overdue" flips at a predictable moment.
  dueAt.setUTCHours(9, 0, 0, 0);

  await taskRepo.createTask(userId, {
    title: `Follow up with ${job.company.name}`,
    description: `Scheduled automatically when ${job.title} moved to ${STATUS_META[status].label}.`,
    taskType: "FOLLOW_UP",
    status: "OPEN",
    priority: job.priority === "HIGH" ? "HIGH" : "MEDIUM",
    dueAt,
    jobId: job.id,
    contactId: null,
    emailId: null,
  });
}

export async function deleteApplication(
  userId: string,
  jobId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await jobRepo.getJobById(userId, jobId);
  if (!existing) return notFound("That application no longer exists");

  const deleted = await jobRepo.deleteJob(userId, jobId);
  if (!deleted) return notFound();

  await logActivity(userId, {
    action: ActivityAction.DELETED,
    entityType: ActivityEntity.JOB,
    entityId: jobId,
    summary: `Deleted ${existing.title} at ${existing.company.name}`,
  });

  return ok({ id: jobId }, "Application deleted");
}

export { fail };
