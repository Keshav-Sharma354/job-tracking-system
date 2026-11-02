/**
 * Email and template repositories.
 *
 * Outbound and inbound messages share one table so a conversation is a single
 * ordered thread rather than two lists that have to be joined in the UI.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  andWhere,
  normalisePaging,
  paginate,
  searchText,
  type Paginated,
} from "@/server/repo/shared";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const templateSelect = {
  id: true,
  name: true,
  category: true,
  subject: true,
  body: true,
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { emails: true } },
} satisfies Prisma.EmailTemplateSelect;

export type TemplateItem = Prisma.EmailTemplateGetPayload<{
  select: typeof templateSelect;
}>;

export async function listTemplates(
  userId: string,
  params: { q?: string; category?: Prisma.EmailTemplateWhereInput["category"] } = {},
): Promise<TemplateItem[]> {
  const text = searchText<Prisma.EmailTemplateWhereInput>(params.q ?? "", [
    "name",
    "subject",
    "body",
  ]);
  return db.emailTemplate.findMany({
    where: andWhere<Prisma.EmailTemplateWhereInput>(
      { userId },
      params.category ? { category: params.category } : undefined,
      text,
    ),
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    select: templateSelect,
  });
}

export async function getTemplateById(
  userId: string,
  templateId: string,
): Promise<TemplateItem | null> {
  return db.emailTemplate.findFirst({
    where: { id: templateId, userId },
    select: templateSelect,
  });
}

export interface TemplateData {
  name: string;
  category: TemplateItem["category"];
  subject: string;
  body: string;
  isFavorite: boolean;
}

export async function createTemplate(
  userId: string,
  data: TemplateData,
): Promise<TemplateItem> {
  return db.emailTemplate.create({
    data: { userId, ...data },
    select: templateSelect,
  });
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  data: Partial<TemplateData>,
): Promise<TemplateItem | null> {
  const existing = await db.emailTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return db.emailTemplate.update({
    where: { id: templateId },
    data,
    select: templateSelect,
  });
}

export async function deleteTemplate(
  userId: string,
  templateId: string,
): Promise<boolean> {
  const { count } = await db.emailTemplate.deleteMany({
    where: { id: templateId, userId },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const emailSelect = {
  id: true,
  direction: true,
  category: true,
  status: true,
  toEmail: true,
  toName: true,
  fromEmail: true,
  subject: true,
  body: true,
  scheduledAt: true,
  sentAt: true,
  repliedAt: true,
  messageId: true,
  errorMessage: true,
  createdAt: true,
  contactId: true,
  contact: { select: { id: true, name: true, email: true } },  jobId: true,
  job: { select: { id: true, title: true, company: { select: { name: true } } } },
  templateId: true,
  inReplyToId: true,
} satisfies Prisma.EmailSelect;

export type EmailItem = Prisma.EmailGetPayload<{ select: typeof emailSelect }>;

export interface EmailFilters {
  q?: string;
  status?: Prisma.EmailWhereInput["status"];
  direction?: Prisma.EmailWhereInput["direction"];
  category?: Prisma.EmailWhereInput["category"];
  contactId?: string;
  jobId?: string;
  /** Only messages that have had at least one real delivery attempt. */
  withReplies?: boolean;
}

function buildWhere(
  userId: string,
  filters: EmailFilters,
): Prisma.EmailWhereInput {
  const clauses: Prisma.EmailWhereInput[] = [{ userId }];

  if (filters.status) clauses.push({ status: filters.status });
  if (filters.direction) clauses.push({ direction: filters.direction });
  if (filters.category) clauses.push({ category: filters.category });
  if (filters.contactId) clauses.push({ contactId: filters.contactId });
  if (filters.jobId) clauses.push({ jobId: filters.jobId });
  if (filters.withReplies === true) {
    clauses.push({ replies: { some: {} } });
  }

  const text = searchText<Prisma.EmailWhereInput>(filters.q ?? "", [
    "subject",
    "body",
    "toEmail",
    "contact.name",
  ]);

  return andWhere<Prisma.EmailWhereInput>({ userId }, ...clauses, text);
}

export async function listEmails(
  userId: string,
  params: EmailFilters & { page?: number; pageSize?: number } = {},
): Promise<Paginated<EmailItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);

  const [items, total] = await Promise.all([
    db.email.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: emailSelect,
      skip,
      take,
    }),
    db.email.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function getEmailById(
  userId: string,
  emailId: string,
): Promise<EmailItem | null> {
  return db.email.findFirst({
    where: { id: emailId, userId },
    select: emailSelect,
  });
}

/** A contact's full conversation, oldest first, for the thread view. */
export async function listThread(
  userId: string,
  contactId: string,
): Promise<EmailItem[]> {
  return db.email.findMany({
    where: { userId, contactId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: emailSelect,
  });
}

export interface EmailData {
  contactId: string | null;
  jobId: string | null;
  templateId: string | null;
  direction: EmailItem["direction"];
  category: EmailItem["category"];
  status: EmailItem["status"];
  toEmail: string | null;
  toName: string | null;
  fromEmail: string | null;
  subject: string;
  body: string;
  scheduledAt: Date | null;
  /** Set on inbound rows to thread the reply onto the message it answers. */
  inReplyToId?: string | null;
}

export async function createEmail(
  userId: string,
  data: EmailData,
): Promise<EmailItem> {
  return db.email.create({
    data: {
      userId,
      contactId: data.contactId,
      jobId: data.jobId,
      templateId: data.templateId,
      direction: data.direction,
      category: data.category,
      status: data.status,
      toEmail: data.toEmail,
      toName: data.toName,
      fromEmail: data.fromEmail,
      subject: data.subject,
      body: data.body,
      scheduledAt: data.scheduledAt,
      inReplyToId: data.inReplyToId ?? null,
    },
    select: emailSelect,
  });
}

export async function updateEmail(
  userId: string,
  emailId: string,
  data: Partial<EmailData> & {
    status?: EmailItem["status"];
    sentAt?: Date | null;
    repliedAt?: Date | null;
    messageId?: string | null;
    errorMessage?: string | null;
  },
): Promise<EmailItem | null> {
  const existing = await db.email.findFirst({
    where: { id: emailId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return db.email.update({
    where: { id: emailId },
    data,
    select: emailSelect,
  });
}

export async function deleteEmail(
  userId: string,
  emailId: string,
): Promise<boolean> {
  const { count } = await db.email.deleteMany({ where: { id: emailId, userId } });
  return count > 0;
}

/**
 * Finds the outbound message a reply answers, so an inbound message can be
 * threaded onto it. Matching prefers the RFC `In-Reply-To` header and falls back
 * to recipient + normalised subject.
 */
export async function findThreadParent(
  userId: string,
  args: {
    inReplyTo?: string | null;
    toEmail?: string | null;
    subject?: string | null;
  },
): Promise<{ id: string; contactId: string | null; jobId: string | null } | null> {
  if (args.inReplyTo) {
    const byMessageId = await db.email.findFirst({
      where: { userId, messageId: args.inReplyTo, direction: "OUTBOUND" },
      select: { id: true, contactId: true, jobId: true },
    });
    if (byMessageId) return byMessageId;
  }

  if (args.toEmail && args.subject) {
    // Strip `Re:`/`Fwd:` prefixes and tags, then compare case-insensitively.
    const normalised = args.subject
      .replace(/^((re|fwd|fw)\s*:\s*)+/i, "")
      .replace(/\[.*?\]/g, "")
      .trim()
      .toLowerCase();

    if (!normalised) return null;

    const candidates = await db.email.findMany({
      where: { userId, toEmail: { equals: args.toEmail, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, contactId: true, jobId: true, subject: true },
    });

    const match = candidates.find((c) => {
      const candidate = c.subject
        .replace(/^((re|fwd|fw)\s*:\s*)+/i, "")
        .replace(/\[.*?\]/g, "")
        .trim()
        .toLowerCase();
      return candidate === normalised;
    });

    if (match) {
      return { id: match.id, contactId: match.contactId, jobId: match.jobId };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export interface DeliveryInput {
  emailId: string;
  attempt: number;
  status: "SENT" | "FAILED";
  provider: string;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export async function recordDelivery(
  userId: string,
  input: DeliveryInput,
): Promise<void> {
  await db.emailDelivery.create({
    data: {
      userId,
      emailId: input.emailId,
      attempt: input.attempt,
      status: input.status,
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

export async function listDeliveries(userId: string, emailId: string) {
  return db.emailDelivery.findMany({
    where: { userId, emailId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      attempt: true,
      status: true,
      provider: true,
      providerMessageId: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}

export async function countByEmailStatus(
  userId: string,
): Promise<Record<string, number>> {
  const grouped = await db.email.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}

/** Outbound volume per month, oldest first, for the reports chart. */
export async function outboundVolumeByMonth(
  userId: string,
  months: number,
): Promise<{ month: string; sent: number; replied: number }[]> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  since.setUTCHours(0, 0, 0, 0);

  const rows = await db.email.findMany({
    where: { userId, direction: "OUTBOUND", sentAt: { gte: since } },
    select: { sentAt: true, status: true },
  });

  const buckets = new Map<string, { sent: number; replied: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    buckets.set(d.toISOString().slice(0, 7), { sent: 0, replied: 0 });
  }

  for (const row of rows) {
    if (!row.sentAt) continue;
    const key = row.sentAt.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.sent += 1;
    if (row.status === "REPLIED") bucket.replied += 1;
  }

  return [...buckets.entries()].map(([month, counts]) => ({ month, ...counts }));
}
