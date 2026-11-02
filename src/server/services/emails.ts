/**
 * Outreach service.
 *
 * Sending is a three-step sequence that is intentionally *not* wrapped in one
 * transaction, because the network call must not hold a database transaction
 * open:
 *
 *   1. Claim the draft (DRAFT → SENT is done after success; the claim guards
 *      against a double-click sending twice).
 *   2. Hand the message to SMTP.
 *   3. Persist the outcome: on success mark SENT and append a delivery record; on
 *      failure restore DRAFT and record why.
 *
 * If the process dies between 2 and 3 the row stays in `SENDING`, which the
 * settings page surfaces as needing review rather than silently claiming success.
 */
import { db } from "@/lib/db";
import {
  ActivityAction,
  ActivityEntity,
  EmailDirection,
  EmailStatus,
} from "@/generated/prisma/enums";
import { FOLLOW_UP_SLA_DAYS } from "@/lib/constants";
import type { EmailDraftData, EmailTemplateData } from "@/lib/validation/schemas";
import * as emailRepo from "@/server/repo/emails";
import * as contactRepo from "@/server/repo/contacts";
import * as jobRepo from "@/server/repo/jobs";
import { logActivity } from "@/server/repo/activity";
import { getEnv } from "@/lib/env";
import {
  MailDeliveryError,

  isMailerConfigured,
  sendMail,
} from "@/server/email/mailer";
import {
  fail,
  fieldError,
  internal,
  notFound,
  ok,
} from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { EmailItem, TemplateItem } from "@/server/repo/emails";

export type { EmailItem, TemplateItem };

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function createTemplate(
  userId: string,
  input: EmailTemplateData,
): Promise<ActionResult<TemplateItem>> {
  const existing = await emailRepo.listTemplates(userId);
  if (existing.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) {
    return fieldError("name", `You already have a template called "${input.name}"`);
  }

  try {
    const template = await emailRepo.createTemplate(userId, input);
    await logActivity(userId, {
      action: ActivityAction.CREATED,
      entityType: ActivityEntity.TEMPLATE,
      entityId: template.id,
      summary: `Created template "${template.name}"`,
    });
    return ok(template, "Template saved");
  } catch (error) {
    console.error("createTemplate failed", error);
    return internal("Could not save this template");
  }
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  input: EmailTemplateData,
): Promise<ActionResult<TemplateItem>> {
  const existing = await emailRepo.getTemplateById(userId, templateId);
  if (!existing) return notFound("That template no longer exists");

  try {
    const template = await emailRepo.updateTemplate(userId, templateId, input);
    if (!template) return notFound();
    return ok(template, "Template updated");
  } catch (error) {
    console.error("updateTemplate failed", error);
    return internal("Could not save your changes");
  }
}

export async function deleteTemplate(
  userId: string,
  templateId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await emailRepo.getTemplateById(userId, templateId);
  if (!existing) return notFound("That template no longer exists");
  const deleted = await emailRepo.deleteTemplate(userId, templateId);
  if (!deleted) return notFound();
  return ok({ id: templateId }, "Template deleted");
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

async function assertLinksOwned(
  userId: string,
  links: { contactId: string | null; jobId: string | null; templateId: string | null },
): Promise<ActionResult<never> | null> {
  if (links.contactId) {
    const contact = await contactRepo.getContactById(userId, links.contactId);
    if (!contact) return fieldError("contactId", "That contact no longer exists");
  }
  if (links.jobId && !(await jobRepo.getJobById(userId, links.jobId))) {
    return fieldError("jobId", "That application no longer exists");
  }
  if (links.templateId && !(await emailRepo.getTemplateById(userId, links.templateId))) {
    return fieldError("templateId", "That template no longer exists");
  }
  return null;
}

export async function createDraft(
  userId: string,
  input: EmailDraftData,
): Promise<ActionResult<EmailItem>> {
  const linkProblem = await assertLinksOwned(userId, input);
  if (linkProblem) return linkProblem;

  // Default the recipient from the selected contact when one is chosen.
  let toEmail = input.toEmail;
  let toName = input.toName;
  if (input.contactId) {
    const contact = await contactRepo.getContactById(userId, input.contactId);
    if (contact) {
      toEmail ??= contact.email;
      toName ??= contact.name;
    }
  }

  if (!toEmail) {
    return fieldError("toEmail", "A recipient email address is required");
  }

  try {
    const email = await emailRepo.createEmail(userId, {
      contactId: input.contactId,
      jobId: input.jobId,
      templateId: input.templateId,
      direction: EmailDirection.OUTBOUND,
      category: input.category,
      status: input.scheduledAt ? EmailStatus.SCHEDULED : EmailStatus.DRAFT,
      toEmail,
      toName,
      fromEmail: getEnv().SMTP_FROM_EMAIL ?? null,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
    });

    return ok(email, "Draft saved");
  } catch (error) {
    console.error("createDraft failed", error);
    return internal("Could not save this draft");
  }
}

export async function updateDraft(
  userId: string,
  emailId: string,
  input: EmailDraftData,
): Promise<ActionResult<EmailItem>> {
  const existing = await emailRepo.getEmailById(userId, emailId);
  if (!existing) return notFound("That message no longer exists");
  if (existing.status === EmailStatus.SENT || existing.status === EmailStatus.REPLIED) {
    return fieldError("status", "A sent message cannot be edited");
  }

  const linkProblem = await assertLinksOwned(userId, input);
  if (linkProblem) return linkProblem;

  try {
    const email = await emailRepo.updateEmail(userId, emailId, {
      contactId: input.contactId,
      jobId: input.jobId,
      templateId: input.templateId,
      category: input.category,
      toEmail: input.toEmail,
      toName: input.toName,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      status: input.scheduledAt ? EmailStatus.SCHEDULED : EmailStatus.DRAFT,
    });
    if (!email) return notFound();
    return ok(email, "Draft updated");
  } catch (error) {
    console.error("updateDraft failed", error);
    return internal("Could not save your changes");
  }
}

export async function deleteMessage(
  userId: string,
  emailId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await emailRepo.getEmailById(userId, emailId);
  if (!existing) return notFound("That message no longer exists");
  const deleted = await emailRepo.deleteEmail(userId, emailId);
  if (!deleted) return notFound();
  return ok({ id: emailId }, "Message deleted");
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function sendDraft(
  userId: string,
  emailId: string,
): Promise<ActionResult<EmailItem>> {
  const email = await emailRepo.getEmailById(userId, emailId);
  if (!email) return notFound("That message no longer exists");

  if (email.direction === EmailDirection.INBOUND) {
    return fieldError("status", "Inbound messages cannot be sent");
  }

  if (email.status === EmailStatus.SENT || email.status === EmailStatus.REPLIED) {
    return fieldError("status", "This message has already been sent");
  }

  if (!email.toEmail) {
    return fieldError("toEmail", "Add a recipient address before sending");
  }

  if (!isMailerConfigured()) {
    // Explicit failure. The message stays a draft; nothing is recorded as sent.
    return fail(
      "MAILER_NOT_CONFIGURED",
      "Email is not configured on this server, so the message was not sent. Set the SMTP_* environment variables to enable sending.",
    );
  }

  // Claim the draft so a second click cannot produce a duplicate send.
  const claimed = await db.email.updateMany({
    where: { id: emailId, userId, status: { in: [EmailStatus.DRAFT, EmailStatus.SCHEDULED, EmailStatus.FAILED] } },
    data: { status: EmailStatus.SENT, errorMessage: null },
  });

  if (claimed.count === 0) {
    return fieldError("status", "This message has already been sent");
  }

  const attempt =
    (await emailRepo.listDeliveries(userId, emailId)).length + 1;

  try {
    const result = await sendMail({
      to: email.toEmail,
      toName: email.toName,
      subject: email.subject,
      body: email.body,
      inReplyTo: email.inReplyToId
        ? ((await emailRepo.getEmailById(userId, email.inReplyToId))?.messageId ?? null)
        : null,
    });

    await emailRepo.recordDelivery(userId, {
      emailId,
      attempt,
      status: "SENT",
      provider: "smtp",
      providerMessageId: result.messageId,
    });

    const updated = await emailRepo.updateEmail(userId, emailId, {
      sentAt: new Date(),
      messageId: result.messageId,
      fromEmail: getEnv().SMTP_FROM_EMAIL ?? null,
      status: EmailStatus.SENT,
    });

    // Touch the contact so the "last contacted" column stays accurate.
    if (email.contactId) {
      await contactRepo.updateContact(userId, email.contactId, {
        lastContactedAt: new Date(),
      } as never);
    }

    await logActivity(userId, {
      action: ActivityAction.EMAIL_SENT,
      entityType: ActivityEntity.EMAIL,
      entityId: emailId,
      contactId: email.contactId,
      jobId: email.jobId,
      emailId,
      summary: `Sent "${email.subject}" to ${email.toEmail}`,
    });

    // A sent message with no reply yet should be followed up.
    await scheduleFollowUp(userId, email);

    return ok(updated!, "Message sent");
  } catch (error) {
    const message =
      error instanceof MailDeliveryError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown delivery error";

    const code = error instanceof MailDeliveryError ? error.code : "SEND_FAILED";

    await emailRepo.recordDelivery(userId, {
      emailId,
      attempt,
      status: "FAILED",
      provider: "smtp",
      errorCode: code,
      errorMessage: message.slice(0, 1000),
    });

    // Roll the row back to a draft so the user can fix and retry.
    await emailRepo.updateEmail(userId, emailId, {
      status: EmailStatus.FAILED,
      errorMessage: message.slice(0, 1000),
    });

    return fail("SEND_FAILED", `The message was not delivered: ${message}`);
  }
}

/** Creates the "did they reply?" reminder for a freshly sent message. */
async function scheduleFollowUp(
  userId: string,
  email: EmailItem,
): Promise<void> {
  if (!email.contactId) return;

  const existing = await db.task.findFirst({
    where: { userId, emailId: email.id, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return;

  const dueAt = new Date(
    Date.now() + FOLLOW_UP_SLA_DAYS.AFTER_EMAIL_SENT * 24 * 60 * 60 * 1000,
  );
  dueAt.setUTCHours(9, 0, 0, 0);

  await db.task.create({
    data: {
      userId,
      title: `Follow up: ${email.subject}`,
      description: `No reply recorded yet for the email sent on ${email.sentAt ?? new Date()}.toLocaleDateString()}.`,
      taskType: "FOLLOW_UP",
      status: "OPEN",
      priority: "MEDIUM",
      dueAt,
      contactId: email.contactId,
      jobId: email.jobId,
      emailId: email.id,
    },
  });
}

// ---------------------------------------------------------------------------
// Inbound replies
// ---------------------------------------------------------------------------

export interface InboundMessage {
  from: string;
  to?: string;
  subject: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  receivedAt?: string;
}

export interface InboundResult {
  emailId: string;
  threaded: boolean;
  contactId: string | null;
}

/**
 * Records an inbound reply and threads it onto the outbound message it answers.
 *
 * Used by the webhook route and by manual "log a reply" entry. Idempotent on
 * `messageId` so a provider that retries a webhook delivery does not create
 * duplicates.
 */
export async function recordInboundReply(
  userId: string,
  message: InboundMessage,
): Promise<ActionResult<InboundResult>> {
  if (message.messageId) {
    const duplicate = await db.email.findFirst({
      where: { userId, messageId: message.messageId },
      select: { id: true, contactId: true },
    });
    if (duplicate) {
      return ok(
        {
          emailId: duplicate.id,
          threaded: false,
          contactId: duplicate.contactId,
        },
        "Reply already recorded",
      );
    }
  }

  const parent = await emailRepo.findThreadParent(userId, {
    inReplyTo: message.inReplyTo,
    toEmail: message.to,
    subject: message.subject,
  });

  // Only trust the parent when it belongs to this user; otherwise look the
  // sender up as a contact.
  let contactId = parent?.contactId ?? null;
  const jobId = parent?.jobId ?? null;

  if (!contactId) {
    const contact = await contactRepo.findContactByEmail(userId, message.from);
    contactId = contact?.id ?? null;
  }

  if (parent) {
    // Promote the outbound message to REPLIED so the list view reflects it.
    await emailRepo.updateEmail(userId, parent.id, {
      status: EmailStatus.REPLIED,
      repliedAt: new Date(),
    });
  }

  try {
    const created = await emailRepo.createEmail(userId, {
      contactId,
      jobId,
      templateId: null,
      direction: EmailDirection.INBOUND,
      category: "RECRUITER_REPLY",
      status: EmailStatus.SENT,
      toEmail: message.to ?? null,
      toName: null,
      fromEmail: message.from,
      subject: message.subject,
      body: message.text,
      scheduledAt: null,
      inReplyToId: parent?.id ?? null,
    });

    await db.email.update({
      where: { id: created.id },
      data: {
        sentAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
        messageId: message.messageId ?? null,
      },
    });

    // Record the contact touch and schedule the reply follow-up.
    if (contactId) {
      await contactRepo
        .updateContact(userId, contactId, { lastContactedAt: new Date() })
        .catch(() => undefined);
    }

    await logActivity(userId, {
      action: ActivityAction.EMAIL_REPLIED,
      entityType: ActivityEntity.EMAIL,
      entityId: created.id,
      contactId,
      jobId,
      emailId: created.id,
      summary: `Reply from ${message.from}: ${message.subject || "(no subject)"}`,
    });

    const dueAt = new Date(
      Date.now() + FOLLOW_UP_SLA_DAYS.AFTER_RECRUITER_REPLY * 24 * 60 * 60 * 1000,
    );
    dueAt.setUTCHours(9, 0, 0, 0);

    await db.task.create({
      data: {
        userId,
        title: `Reply to ${message.from}`,
        description: message.subject || "Reply received",
        taskType: "EMAIL",
        status: "OPEN",
        priority: "HIGH",
        dueAt,
        contactId,
        jobId,
        emailId: created.id,
      },
    });

    return ok(
      { emailId: created.id, threaded: Boolean(parent), contactId },
      parent ? "Reply threaded to your message" : "Reply recorded",
    );
  } catch (error) {
    console.error("recordInboundReply failed", error);
    return internal("Could not record this reply");
  }
}
