/**
 * Shared query shapes and filter helpers for the repository layer.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus, Priority } from "@/generated/prisma/enums";

/**
 * Builds a free-text `OR` clause across several columns, typed as whatever
 * `WhereInput` the calling model needs.
 *
 * Dotted paths address related columns and are converted into the nested shape
 * Prisma expects: `"company.name"` becomes
 * `{ company: { name: { contains, mode } } }`.
 *
 * Returns `undefined` for a blank query so callers can omit the clause.
 */
export function searchText<T extends object>(
  query: string,
  fields: readonly string[],
): T | undefined {
  const q = query.trim();
  if (!q) return undefined;

  return {
    OR: fields.map((field) => {
      const match = { contains: q, mode: "insensitive" };
      // Wrap from the right so `a.b` becomes `{ a: { b: match } }`.
      return field
        .split(".")
        .reduceRight<Record<string, unknown>>(
          (acc, segment) => ({ [segment]: acc }),
          match,
        );
    }),
  } as unknown as T;
}

export type SortDirection = "asc" | "desc";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export function normalisePaging(input?: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, Math.floor(input?.page ?? 1));
  const rawSize = Math.floor(input?.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Composes a base scope with optional extra clauses into a single `AND`. */
export function andWhere<T extends object>(
  base: T,
  ...rest: Array<T | undefined>
): T {
  const parts = rest.filter((c): c is T => c !== undefined);
  if (parts.length === 0) return base;
  return { AND: [base, ...parts] } as unknown as T;
}

export type JobSortKey =
  | "updatedAt"
  | "createdAt"
  | "title"
  | "deadlineAt"
  | "appliedAt"
  | "status";

export interface JobFilters {
  q?: string;
  statuses?: ApplicationStatus[];
  companyId?: string;
  priority?: Priority;
  /** Only jobs whose deadline falls within this many days (inclusive of past). */
  dueWithinDays?: number;
  hasDeadline?: boolean;
  tags?: string[];
  sort?: JobSortKey;
  direction?: SortDirection;
}

export function jobOrderBy(
  sort: JobSortKey = "updatedAt",
  direction: SortDirection = "desc",
): Prisma.JobOrderByWithRelationInput[] {
  const dir = direction === "asc" ? "asc" : "desc";
  const primary: Prisma.JobOrderByWithRelationInput = {
    [sort]: dir,
  };
  // Deterministic tiebreaker so pagination cannot repeat or skip a row.
  return [primary, { id: "asc" }];
}
