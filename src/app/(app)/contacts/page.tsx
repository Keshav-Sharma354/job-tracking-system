import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listContacts } from "@/server/repo/contacts";
import { listAllCompanies } from "@/server/repo/companies";
import { CONTACT_TYPE_LABELS } from "@/lib/constants";
import { formatRelativeDue } from "@/lib/utils/date";
import { Avatar, LabelBadge, StatusBadge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { NewContactButton } from "@/components/features/contacts/contact-form-dialog";

export const metadata: Metadata = { title: "Contacts" };

const PER_PAGE = 30;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";

  const q = first(params.q);
  const contactType = first(params.type);
  const companyId = first(params.companyId);

  const [result, companies] = await Promise.all([
    listContacts(session.userId, {
      q: q || undefined,
      contactType: (contactType as never) || undefined,
      companyId: companyId || undefined,
      sort: "name",
      direction: "asc",
      page: Number(first(params.page)) || 1,
      pageSize: PER_PAGE,
    }),
    listAllCompanies(session.userId),
  ]);

  const options = { companies: companies.map((c) => ({ id: c.id, name: c.name })) };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        description={`${result.total} ${result.total === 1 ? "person" : "people"} in your network`}
        actions={<NewContactButton options={options} />}
      />

      {/* Filters */}
      <ContactFilters
        q={q}
        contactType={contactType}
        companyId={companyId}
        companies={options.companies}
      />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q || contactType ? "No contacts match" : "No contacts yet"}
            description={
              q || contactType
                ? "Try a different search or filter."
                : "Save the recruiters and hiring managers you talk to so every conversation has context."
            }
            action={
              !q && !contactType ? (
                <NewContactButton options={options} />
              ) : (
                <Link
                  href="/contacts"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Clear filters
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {result.items.map((contact) => (
              <li
                key={contact.id}
                className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60"
              >
                <Avatar label={contact.name} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-accent"
                    >
                      {contact.name}
                    </Link>
                    <StatusBadge label={CONTACT_TYPE_LABELS[contact.contactType]} />
                    {contact.relationship !== "UNKNOWN" ? (
                      <StatusBadge
                        label={contact.relationship.toLowerCase()}
                        tone={
                          contact.relationship === "STRONG" ? "success" : "neutral"
                        }
                      />
                    ) : null}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[contact.title, contact.company?.name].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1 text-subtle hover:text-accent hover:underline"
                      >
                        <Mail className="size-3" aria-hidden />
                        {contact.email}
                      </a>
                    ) : null}
                    {contact.phone ? (
                      <span className="inline-flex items-center gap-1 text-subtle">
                        <Phone className="size-3" aria-hidden />
                        {contact.phone}
                      </span>
                    ) : null}
                    {contact.tags.slice(0, 3).map((tag) => (
                      <LabelBadge key={tag} seed={tag}>
                        {tag}
                      </LabelBadge>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-subtle">
                    {contact.lastContactedAt
                      ? formatRelativeDue(
                          contact.lastContactedAt,
                          new Date(),
                          session.user.timezone,
                        )
                      : "never contacted"}
                  </p>
                  <p className="text-xs text-subtle">
                    {contact._count.emails} email{contact._count.emails === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ContactFilters({
  q,
  contactType,
  companyId,
  companies,
}: {
  q: string;
  contactType: string;
  companyId: string;
  companies: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search name, title, email…"
        aria-label="Search contacts"
        className="min-w-48 flex-1 sm:max-w-xs"
      />
      <Select
        name="type"
        defaultValue={contactType}
        aria-label="Filter by role"
        className="w-auto min-w-40"
      >
        <option value="">All roles</option>
        {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        name="companyId"
        defaultValue={companyId}
        aria-label="Filter by company"
        className="w-auto min-w-44"
      >
        <option value="">All companies</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="md">
        Filter
      </Button>
      {q || contactType || companyId ? (
        <Button type="button" variant="ghost" size="md" asChild>
          <Link href="/contacts">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
