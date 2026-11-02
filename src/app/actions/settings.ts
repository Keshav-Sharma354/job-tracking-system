'use server';

/**
 * Settings-only actions (resume versions). Kept apart from `crm.ts` so the
 * boundary between core CRM mutations and account configuration stays clear.
 */
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { resumeSchema } from "@/lib/validation/schemas";
import { idParamSchema } from "@/lib/validation/schemas";
import { invalid, notFound, ok, unauthorized } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import {
  createResumeVersion,
  deleteResumeVersion,
  getResumeVersion,
  listResumeVersions,
  setDefaultResume,
  updateResumeVersion,
} from "@/server/repo/activity";
import type { ResumeItem } from "@/server/repo/activity";

export async function setDefaultResumeAction(
  resumeId: string,
): Promise<ActionResult<ResumeItem>> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return unauthorized() as ActionResult<ResumeItem>;

  const parsed = idParamSchema.safeParse({ id: resumeId });
  if (!parsed.success) return invalid("Invalid resume id") as ActionResult<ResumeItem>;

  const existing = await getResumeVersion(userId, parsed.data.id);
  if (!existing) return notFound("That resume version no longer exists");

  const resume = await setDefaultResume(userId, parsed.data.id);
  if (!resume) return notFound();

  revalidatePath("/settings");
  revalidatePath("/jobs");
  return ok(resume, `${resume.label} is now your default resume`);
}

export async function createResumeVersionAction(
  input: unknown,
): Promise<ActionResult<ResumeItem>> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return unauthorized() as ActionResult<ResumeItem>;

  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<ResumeItem>;

  const existing = await listResumeVersions(userId);
  if (
    existing.some(
      (r) => r.label.toLowerCase() === parsed.data.label.toLowerCase(),
    )
  ) {
    return invalid(
      `You already have a resume version called "${parsed.data.label}"`,
    ) as ActionResult<ResumeItem>;
  }

  const resume = await createResumeVersion(userId, {
    label: parsed.data.label,
    fileUrl: parsed.data.fileUrl ?? null,
    summary: parsed.data.summary ?? null,
  });

  // The first resume becomes the default automatically.
  if (existing.length === 0) {
    await setDefaultResume(userId, resume.id);
  }

  revalidatePath("/settings");
  return ok(resume, "Resume version added");
}

export async function updateResumeVersionAction(
  resumeId: string,
  input: unknown,
): Promise<ActionResult<ResumeItem>> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return unauthorized() as ActionResult<ResumeItem>;

  const parsedId = idParamSchema.safeParse({ id: resumeId });
  if (!parsedId.success) {
    return invalid("Invalid resume id") as ActionResult<ResumeItem>;
  }

  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<ResumeItem>;

  const resume = await updateResumeVersion(userId, parsedId.data.id, {
    label: parsed.data.label,
    fileUrl: parsed.data.fileUrl ?? null,
    summary: parsed.data.summary ?? null,
  });
  if (!resume) return notFound();

  revalidatePath("/settings");
  return ok(resume, "Resume version updated");
}

export async function deleteResumeVersionAction(
  resumeId: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return unauthorized() as ActionResult<{ id: string }>;

  const parsed = idParamSchema.safeParse({ id: resumeId });
  if (!parsed.success) return invalid("Invalid resume id");

  const existing = await getResumeVersion(userId, parsed.data.id);
  if (!existing) return notFound("That resume version no longer exists");

  const deleted = await deleteResumeVersion(userId, parsed.data.id);
  if (!deleted) return notFound();

  revalidatePath("/settings");
  revalidatePath("/jobs");
  return ok({ id: parsed.data.id }, "Resume version deleted");
}
