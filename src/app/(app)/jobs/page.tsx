import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listJobs } from "@/server/repo/jobs";
import { listAllCompanies } from "@/server/repo/companies";
import { listResumeVersions } from "@/server/repo/activity";
import { listContacts } from "@/server/repo/contacts";
import { APPLICATION_STATUSES, STATUS_META } from "@/lib/constants";
import { captureNow } from "@/lib/utils/clock";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/badge";
import { JobsToolbar, type JobsFilterState } from "@/components/features/jobs/jobs-toolbar";
import { JobRow } from "@/components/features/jobs/job-cards";
import { NewJobButton } from "@/components/features/jobs/job-form-dialog";
import type { JobFormOptions } from "@/components/features/jobs/job-form-fields";

export const metadata: Metadata = { title: "Applications" };

const PER_PAGE = 25;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

  const filters: JobsFilterState = {
    q: first(params.q),
    status: first(params.status),
    companyId: first(params.companyId),
    priority: first(params.priority),
    sort: first(params.sort) || "updatedAt",
    direction: first(params.direction) || "desc",
    page: Number(first(params.page)) || 1,
  };

  const statuses = filters.status
    ? (APPLICATION_STATUSES.includes(filters.status as never)
        ? [filters.status as never]
        : [])
    : undefined;

  const [result, companies, resumes, contacts] = await Promise.all([
    listJobs(session.userId, {
      q: filters.q || undefined,
      statuses,
      companyId: filters.companyId || undefined,
      priority: (filters.priority as never) || undefined,
      sort: (filters.sort as never) ?? "updatedAt",
      direction: (filters.direction as never) ?? "desc",
      page: filters.page,
      pageSize: PER_PAGE,
    }),
    listAllCompanies(session.userId),
    listResumeVersions(session.userId),
    listContacts(session.userId, { pageSize: 100 }),
  ]);

  const formOptions: JobFormOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    resumeVersions: resumes.map((r) => ({ id: r.id, label: r.label })),
    referralContacts: contacts.items.map((c) => ({ id: c.id, name: c.name })),
  };

  // Captured once per request so every row on the page agrees on "now".
  const now = captureNow();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Applications"
        description={`${result.total} ${result.total === 1 ? "role" : "roles"} tracked`}
        actions={
          <>
            <Link
              href="/jobs/board"
              className="inline-flex h-9 items-center rounded-lg bg-surface px-3.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border-strong transition-colors hover:bg-surface-hover"
            >
              Kanban board
            </Link>
            <NewJobButton options={formOptions} />
          </>
        }
      />

      <JobsToolbar
        filters={filters}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title={
              result.total === 0 && !filters.q && !filters.status
                ? "No applications yet"
                : "Nothing matches those filters"
            }
            description={
              result.total === 0 && !filters.q && !filters.status
                ? "Add the roles you are applying to and this list becomes your pipeline."
                : "Try widening the search or clearing a filter."
            }
            action={
              result.total === 0 && !filters.q && !filters.status ? (
                <NewJobButton options={formOptions} />
              ) : (
                <Link
                  href="/jobs"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Clear filters
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                    Role
                  </th>
                  <th className="hidden px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle md:table-cell">
                    Stage
                  </th>
                  <th className="hidden px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle lg:table-cell">
                    Location
                  </th>
                  <th className="hidden px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle lg:table-cell">
                    Salary
                  </th>
                  <th className="hidden px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle sm:table-cell">
                    Priority
                  </th>
                  <th className="px-4 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                    Deadline
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    timezone={session.user.timezone}
                    now={now}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {result.pageCount > 1 ? (
        <Pagination page={result.page} pageCount={result.pageCount} filters={filters} />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  filters,
}: {
  page: number;
  pageCount: number;
  filters: JobsFilterState;
}) {
  const href = (target: number) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.status) sp.set("status", filters.status);
    if (filters.companyId) sp.set("companyId", filters.companyId);
    if (filters.priority) sp.set("priority", filters.priority);
    if (filters.sort !== "updatedAt") sp.set("sort", filters.sort);
    if (filters.direction !== "desc") sp.set("direction", filters.direction);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/jobs?${qs}` : "/jobs";
  };

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <PageLink href={href(page - 1)} disabled={page <= 1}>
        Previous
      </PageLink>
      <span className="px-2 text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      <PageLink href={href(page + 1)} disabled={page >= pageCount}>
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
    (disabled
      ? "pointer-events-none text-subtle opacity-50"
      : "text-foreground ring-1 ring-border hover:bg-surface-hover");

  return disabled ? (
    <span className={className} aria-disabled>
      {children}
    </span>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export { StatusBadge, STATUS_META };
