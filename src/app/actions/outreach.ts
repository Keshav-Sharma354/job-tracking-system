'use server';

/**
 * Outreach actions.
 *
 * `sendEmailAction` is the only path that can put a message on the wire. It
 * delegates to the service, which refuses with `MAILER_NOT_CONFIGURED` when SMTP
 * is absent — the client renders that as an explicit, non-success message rather
 * than pretending the email was delivered.
 */
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  emailDraftSchema,
  emailTemplateSchema,
  sendEmailSchema,
} from "@/lib/validation/schemas";
import { idParamSchema } from "@/lib/validation/schemas";
import { invalid, unauthorized } from "@/lib/utils/result";
import {
  createDraft,
  createTemplate,
  deleteMessage,
  deleteTemplate,
  recordInboundReply,
  sendDraft,
  updateDraft,
  updateTemplate,
} from "@/server/services/emails";
import type { InboundMessage } from "@/server/services/emails";
import type { ActionResult } from "@/lib/utils/result";
import type { EmailItem, TemplateItem } from "@/server/repo/emails";

async function requireUser(): Promise<{ userId: string } | { denied: true }> {
  try {
    return { userId: await requireUserId() };
  } catch {
    return { denied: true };
  }
}

function parseId(id: string): string | null {
  const parsed = idParamSchema.safeParse({ id });
  return parsed.success ? parsed.data.id : null;
}

function refreshOutreach() {
  revalidatePath("/emails");
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  revalidatePath("/tasks");
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function createTemplateAction(
  input: unknown,
): Promise<ActionResult<TemplateItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TemplateItem>;

  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<TemplateItem>;

  const result = await createTemplate(auth.userId, parsed.data);
  if (result.ok) refreshOutreach();
  return result;
}

export async function updateTemplateAction(
  templateId: string,
  input: unknown,
): Promise<ActionResult<TemplateItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TemplateItem>;

  const id = parseId(templateId);
  if (!id) return invalid("Invalid template id") as ActionResult<TemplateItem>;

  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<TemplateItem>;

  const result = await updateTemplate(auth.userId, id, parsed.data);
  if (result.ok) refreshOutreach();
  return result;
}

export async function deleteTemplateAction(
  templateId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(templateId);
  if (!id) return invalid("Invalid template id");

  const result = await deleteTemplate(auth.userId, id);
  if (result.ok) refreshOutreach();
  return result;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export async function createDraftAction(
  input: unknown,
): Promise<ActionResult<EmailItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<EmailItem>;

  const parsed = emailDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<EmailItem>;

  const result = await createDraft(auth.userId, parsed.data);
  if (result.ok) refreshOutreach();
  return result;
}

export async function updateDraftAction(
  emailId: string,
  input: unknown,
): Promise<ActionResult<EmailItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<EmailItem>;

  const id = parseId(emailId);
  if (!id) return invalid("Invalid message id") as ActionResult<EmailItem>;

  const parsed = emailDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<EmailItem>;

  const result = await updateDraft(auth.userId, id, parsed.data);
  if (result.ok) refreshOutreach();
  return result;
}

export async function sendEmailAction(
  input: unknown,
): Promise<ActionResult<EmailItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<EmailItem>;

  const parsed = sendEmailSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<EmailItem>;

  const result = await sendDraft(auth.userId, parsed.data.emailId);
  if (result.ok) refreshOutreach();
  return result;
}

export async function deleteEmailAction(
  emailId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(emailId);
  if (!id) return invalid("Invalid message id");

  const result = await deleteMessage(auth.userId, id);
  if (result.ok) refreshOutreach();
  return result;
}

/**
 * Records a reply typed in by hand (phone call, LinkedIn DM, in-person chat).
 * The webhook route calls the same service for genuine inbound mail.
 */
export async function logReplyAction(
  input: unknown,
): Promise<ActionResult<{ emailId: string; threaded: boolean; contactId: string | null }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as never;

  const parsed = emailDraftSchema
    .pick({ toEmail: true, subject: true, body: true })
    .extend({ contactId: emailDraftSchema.shape.contactId })
    .safeParse(input);

  if (!parsed.success) return invalid(parsed.error) as never;

  const message: InboundMessage = {
    from: parsed.data.toEmail!,
    subject: parsed.data.subject,
    text: parsed.data.body,
  };

  const result = await recordInboundReply(auth.userId, message);
  if (result.ok) refreshOutreach();
  return result;
}
