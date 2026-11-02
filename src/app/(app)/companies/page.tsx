import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Globe } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listCompanies, listCompanyTags } from "@/server/repo/companies";
import { Avatar, LabelBadge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { ResourceFormTrigger } from "@/components/ui/resource-form";
import { companyFormFields } from "@/components/features/companies/company-form-fields";
import { createCompanyFromFormAction } from "@/app/actions/crm";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";
  const q = first(params.q);

  const [result, tagCounts] = await Promise.all([
    listCompanies(session.userId, { q: q || undefined, pageSize: 100 }),
    listCompanyTags(session.userId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Companies"
        description={`${result.total} ${result.total === 1 ? "company" : "companies"} tracked`}
        actions={
          <ResourceFormTrigger
            label="Add company"
            icon={<Building2 className="size-4" />}
            title="Add company"
            description="Research you can reuse across applications."
            submitLabel="Add company"
            fields={companyFormFields()}
            action={createCompanyFromFormAction}
          />
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search companies…"
          aria-label="Search companies"
          className="h-9 min-w-48 max-w-xs flex-1 rounded-lg border border-input bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-surface px-3.5 text-sm font-medium shadow-sm ring-1 ring-border-strong transition-colors hover:bg-surface-hover"
        >
          Search
        </button>
        {tagCounts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {tagCounts.slice(0, 8).map(({ tag, count }) => (
              <Link key={tag} href={`/companies?tag=${encodeURIComponent(tag)}`}>
                <LabelBadge seed={tag}>
                  {tag} · {count}
                </LabelBadge>
              </Link>
            ))}
          </div>
        ) : null}
      </form>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={q ? "No companies match" : "No companies yet"}
            description={
              q
                ? "Try a different search term."
                : "Companies are created automatically when you add an application, so this may fill itself in."
            }
          />
        ) : (
          <ul className="grid gap-px bg-border sm:grid-cols-2">
            {result.items.map((company) => (
              <li key={company.id} className="bg-surface p-4 transition-colors hover:bg-surface-hover/60">
                <div className="flex items-start gap-3">
                  <Avatar label={company.name} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/companies/${company.id}`}
                      className="block truncate text-sm font-medium text-foreground hover:text-accent"
                    >
                      {company.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[company.industry, company.location, company.size]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted ring-1 ring-inset ring-border">
                    {company._count.jobs} application
                    {company._count.jobs === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted ring-1 ring-inset ring-border">
                    {company._count.contacts} contact
                    {company._count.contacts === 1 ? "" : "s"}
                  </span>
                  {company.websiteUrl ? (
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit the ${company.name} website`}
                      className="ml-auto rounded p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-accent"
                    >
                      <Globe className="size-3.5" />
                    </a>
                  ) : null}
                </div>

                {company.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {company.tags.map((tag) => (
                      <LabelBadge key={tag} seed={tag}>
                        {tag}
                      </LabelBadge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
