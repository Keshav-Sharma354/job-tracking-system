'use server';

/**
 * Application (job) actions.
 *
 * Pattern for every action in this file:
 *   1. authenticate   — `requireUserId()` throws for anonymous callers
 *   2. validate       — Zod schema over the raw FormData
 *   3. delegate       — the service owns business rules and activity logging
 *   4. revalidate     — refresh the affected routes
 *
 * No action trusts an id from the client: the service re-checks ownership, so a
 * crafted id from another account yields NOT_FOUND rather than data.
 */
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { jobSchema, moveJobSchema } from "@/lib/validation/schemas";
import { idParamSchema } from "@/lib/validation/schemas";
import { invalid, unauthorized } from "@/lib/utils/result";
import {
  createApplication,
  deleteApplication,
  moveApplication,
  updateApplication,
} from "@/server/services/jobs";
import * as jobRepo from "@/server/repo/jobs";
import * as analytics from "@/server/services/analytics";
import type { ActionResult } from "@/lib/utils/result";
import type { JobDetail, JobListItem } from "@/server/repo/jobs";

function refreshJobs() {
  revalidatePath("/jobs");
  revalidatePath("/jobs/board");
  revalidatePath("/dashboard");
}

/** Shared guard: validates the id param and resolves the caller. */
async function guard(): Promise<{ userId: string } | { error: ReturnType<typeof unauthorized> }> {
  try {
    return { userId: await requireUserId() };
  } catch {
    return { error: unauthorized() };
  }
}

function parseId(id: string) {
  const parsed = idParamSchema.safeParse({ id });
  return parsed.success ? parsed.data.id : null;
}

export async function createJobAction(
  input: unknown,
): Promise<ActionResult<JobDetail>> {
  const auth = await guard();
  if ("error" in auth) return auth.error as ActionResult<JobDetail>;

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<JobDetail>;

  const result = await createApplication(auth.userId, parsed.data);
  if (result.ok) refreshJobs();
  return result;
}

export async function updateJobAction(
  jobId: string,
  input: unknown,
): Promise<ActionResult<JobDetail>> {
  const auth = await guard();
  if ("error" in auth) return auth.error as ActionResult<JobDetail>;

  const id = parseId(jobId);
  if (!id) return invalid("Invalid application id") as ActionResult<JobDetail>;

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<JobDetail>;

  const result = await updateApplication(auth.userId, id, parsed.data);
  if (result.ok) {
    refreshJobs();
    revalidatePath(`/jobs/${id}`);
  }
  return result;
}

export async function moveJobAction(
  input: unknown,
): Promise<ActionResult<JobDetail>> {
  const auth = await guard();
  if ("error" in auth) return auth.error as ActionResult<JobDetail>;

  const parsed = moveJobSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<JobDetail>;

  const result = await moveApplication(
    auth.userId,
    parsed.data.jobId,
    parsed.data.status,
  );
  if (result.ok) refreshJobs();
  return result;
}

export async function deleteJobAction(
  jobId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await guard();
  if ("error" in auth) return auth.error as ActionResult<{ id: string }>;

  const id = parseId(jobId);
  if (!id) return invalid("Invalid application id");

  const result = await deleteApplication(auth.userId, id);
  if (result.ok) {
    refreshJobs();
    revalidatePath(`/jobs/${id}`);
  }
  return result;
}

/** Kanban board payload: every job grouped into its status column. */
export async function getBoardAction(): Promise<
  ActionResult<{ columns: Record<string, JobListItem[]>; counts: Record<string, number> }>
> {
  const auth = await guard();
  if ("error" in auth) {
    return auth.error as ActionResult<{ columns: Record<string, JobListItem[]>; counts: Record<string, number> }>;
  }

  const [jobs, counts] = await Promise.all([
    jobRepo.listAllJobs(auth.userId, { sort: "updatedAt", direction: "desc" }),
    jobRepo.countByStatus(auth.userId),
  ]);

  const columns: Record<string, JobListItem[]> = {};
  for (const job of jobs) {
    (columns[job.status] ??= []).push(job);
  }

  return { ok: true, data: { columns, counts } };
}

export async function getKanbanStatsAction() {
  const auth = await guard();
  if ("error" in auth) return auth.error as never;
  return analytics.getPipelineCounts(auth.userId);
}
