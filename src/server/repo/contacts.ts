/**
 * Contact repository.
 *
 * Contacts may optionally belong to a company. The company is only ever linked
 * by id *and* validated against the same `userId` in the service layer, so a
 * crafted payload cannot attach a contact to another user's company.
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

export const contactSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  linkedinUrl: true,
  title: true,
  contactType: true,
  relationship: true,
  lastContactedAt: true,
  notes: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  companyId: true,
  company: { select: { id: true, name: true } },
  _count: { select: { emails: true, tasks: true, noteRecords: true } },
} satisfies Prisma.ContactSelect;

export type ContactItem = Prisma.ContactGetPayload<{
  select: typeof contactSelect;
}>;

export interface ContactFilters {
  q?: string;
  contactType?: Prisma.ContactGetPayload<{ select: typeof contactSelect }>["contactType"];
  companyId?: string;
  hasEmail?: boolean;
  tags?: string[];
  sort?: "name" | "updatedAt" | "lastContactedAt";
  direction?: "asc" | "desc";
}

function buildWhere(
  userId: string,
  filters: ContactFilters,
): Prisma.ContactWhereInput {
  const clauses: Prisma.ContactWhereInput[] = [{ userId }];

  if (filters.contactType) clauses.push({ contactType: filters.contactType });
  if (filters.companyId) clauses.push({ companyId: filters.companyId });
  if (filters.tags?.length) clauses.push({ tags: { hasSome: filters.tags } });
  if (filters.hasEmail === true) clauses.push({ email: { not: null } });

  const text = searchText<Prisma.ContactWhereInput>(filters.q ?? "", [
    "name",
    "email",
    "title",
    "notes",
    "company.name",
  ]);

  return andWhere<Prisma.ContactWhereInput>({ userId }, ...clauses, text);
}

export async function listContacts(
  userId: string,
  params: ContactFilters & { page?: number; pageSize?: number } = {},
): Promise<Paginated<ContactItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);
  const dir = params.direction === "asc" ? "asc" : "desc";

  const [items, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: [{ [params.sort ?? "updatedAt"]: dir }, { name: "asc" }],
      select: contactSelect,
      skip,
      take,
    }),
    db.contact.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function listAllContacts(
  userId: string,
  filters: ContactFilters = {},
): Promise<ContactItem[]> {
  const dir = filters.direction === "asc" ? "asc" : "desc";
  return db.contact.findMany({
    where: buildWhere(userId, filters),
    orderBy: [{ [filters.sort ?? "updatedAt"]: dir }, { name: "asc" }],
    select: contactSelect,
  });
}

export async function getContactById(
  userId: string,
  contactId: string,
): Promise<ContactItem | null> {
  return db.contact.findFirst({
    where: { id: contactId, userId },
    select: contactSelect,
  });
}

export async function findContactByEmail(
  userId: string,
  email: string,
): Promise<ContactItem | null> {
  return db.contact.findFirst({
    where: { userId, email: { equals: email, mode: "insensitive" } },
    select: contactSelect,
  });
}

export interface ContactData {
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  title: string | null;
  companyId: string | null;
  contactType: ContactItem["contactType"];
  relationship: ContactItem["relationship"];
  lastContactedAt: Date | null;
  notes: string | null;
  tags: string[];
}

export async function createContact(
  userId: string,
  data: ContactData,
): Promise<ContactItem> {
  return db.contact.create({
    data: {
      userId,
      companyId: data.companyId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      linkedinUrl: data.linkedinUrl,
      title: data.title,
      contactType: data.contactType,
      relationship: data.relationship,
      lastContactedAt: data.lastContactedAt,
      notes: data.notes,
      tags: data.tags,
    },
    select: contactSelect,
  });
}

export async function updateContact(
  userId: string,
  contactId: string,
  data: Partial<ContactData>,
): Promise<ContactItem | null> {
  const existing = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  const payload: Prisma.ContactUpdateInput = {
    company:
      data.companyId === undefined
        ? undefined
        : data.companyId
          ? { connect: { id: data.companyId } }
          : { disconnect: true },
  };

  const scalars: (keyof ContactData)[] = [
    "name",
    "email",
    "phone",
    "linkedinUrl",
    "title",
    "contactType",
    "relationship",
    "lastContactedAt",
    "notes",
    "tags",
  ];

  for (const key of scalars) {
    if (data[key] !== undefined) {
      (payload as Record<string, unknown>)[key] = data[key];
    }
  }

  return db.contact.update({
    where: { id: contactId },
    data: payload,
    select: contactSelect,
  });
}

export async function deleteContact(
  userId: string,
  contactId: string,
): Promise<boolean> {
  const { count } = await db.contact.deleteMany({
    where: { id: contactId, userId },
  });
  return count > 0;
}

export async function searchContacts(
  userId: string,
  query: string,
  limit = 20,
): Promise<ContactItem[]> {
  const q = query.trim();
  return db.contact.findMany({
    where: andWhere({ userId }, searchText(q, ["name", "email", "title"]) as never),
    orderBy: { name: "asc" },
    take: limit,
    select: contactSelect,
  });
}

export async function countByContactType(
  userId: string,
): Promise<Record<string, number>> {
  const grouped = await db.contact.groupBy({
    by: ["contactType"],
    where: { userId },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.contactType, g._count._all]));
}
