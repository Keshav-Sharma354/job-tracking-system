/**
 * Company repository. Same tenancy contract as every other repository: the
 * owning `userId` is part of the WHERE clause for all operations.
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

export const companySelect = {
  id: true,
  name: true,
  websiteUrl: true,
  linkedinUrl: true,
  industry: true,
  location: true,
  size: true,
  notes: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { jobs: true, contacts: true } },
} satisfies Prisma.CompanySelect;

export type CompanyItem = Prisma.CompanyGetPayload<{
  select: typeof companySelect;
}>;

function buildWhere(
  userId: string,
  filters: { q?: string; tags?: string[] },
): Prisma.CompanyWhereInput {
  const clauses: Prisma.CompanyWhereInput[] = [{ userId }];
  if (filters.tags?.length) clauses.push({ tags: { hasSome: filters.tags } });
  const text = searchText<Prisma.CompanyWhereInput>(filters.q ?? "", [
    "name",
    "industry",
    "location",
  ]);
  return andWhere<Prisma.CompanyWhereInput>({ userId }, ...clauses, text);
}

export async function listCompanies(
  userId: string,
  params: {
    q?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  } = {},
): Promise<Paginated<CompanyItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);

  const [items, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: companySelect,
      skip,
      take,
    }),
    db.company.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function listAllCompanies(
  userId: string,
  params: { q?: string } = {},
): Promise<CompanyItem[]> {
  return db.company.findMany({
    where: buildWhere(userId, params),
    orderBy: { name: "asc" },
    select: companySelect,
  });
}

export async function getCompanyById(
  userId: string,
  companyId: string,
): Promise<CompanyItem | null> {
  return db.company.findFirst({
    where: { id: companyId, userId },
    select: companySelect,
  });
}

export async function findCompanyByName(
  userId: string,
  name: string,
): Promise<CompanyItem | null> {
  return db.company.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: companySelect,
  });
}

export interface CompanyData {
  name: string;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  notes: string | null;
  tags: string[];
}

export async function createCompany(
  userId: string,
  data: CompanyData,
): Promise<CompanyItem> {
  return db.company.create({
    data: { userId, ...data },
    select: companySelect,
  });
}

export async function updateCompany(
  userId: string,
  companyId: string,
  data: Partial<CompanyData>,
): Promise<CompanyItem | null> {
  const existing = await db.company.findFirst({
    where: { id: companyId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return db.company.update({
    where: { id: companyId },
    data,
    select: companySelect,
  });
}

export async function deleteCompany(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { count } = await db.company.deleteMany({
    where: { id: companyId, userId },
  });
  return count > 0;
}

/** Autocomplete source for company pickers. */
export async function searchCompanyNames(
  userId: string,
  query: string,
  limit = 20,
): Promise<{ id: string; name: string }[]> {
  return db.company.findMany({
    where: {
      userId,
      ...(query.trim() ? { name: { contains: query.trim(), mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true },
  });
}

/** Every tag in use by this user, with counts, for the filter sidebar. */
export async function listCompanyTags(
  userId: string,
): Promise<{ tag: string; count: number }[]> {
  const rows = await db.company.findMany({
    where: { userId },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const { tags } of rows) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
