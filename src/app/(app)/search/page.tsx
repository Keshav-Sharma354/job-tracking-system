import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { globalSearch } from "@/server/repo/activity";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Search" };

const GROUPS = [
  { key: "jobs", label: "Applications", href: "/jobs" },
  { key: "contacts", label: "Contacts", href: "/contacts" },
  { key: "companies", label: "Companies", href: "/companies" },
  { key: "notes", label: "Notes", href: "/notes" },
  { key: "emails", label: "Emails", href: "/emails" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
] as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";

  const q = first(params.q).trim();
  const scope = first(params.scope);
  const only = GROUPS.some((g) => g.key === scope) ? scope : "";

  const results = q
    ? await globalSearch(session.userId, q, only ? 50 : 10)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search"
        description="Search applications, contacts, companies, notes, emails and tasks at once."
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Search everything…"
          aria-label="Search query"
          className="min-w-48 flex-1 sm:max-w-md"
        />
        <Select
          name="scope"
          defaultValue={only}
          aria-label="Limit search to"
          className="w-auto min-w-40"
        >
          <option value="">Everything</option>
          {GROUPS.map((group) => (
            <option key={group.key} value={group.key}>
              {group.label} only
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="md">
          Search
        </Button>
        {q ? (
          <Button type="button" variant="ghost" size="md" asChild>
            <Link href="/search">Clear</Link>
          </Button>
        ) : null}
      </form>

      {!q ? (
        <Card>
          <EmptyState
            title="What are you looking for?"
            description="Type at least two characters. Results are limited to your own records."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {GROUPS.map((group) => {
            const items = results?.[group.key] ?? [];
            if (only && only !== group.key) return null;
            if (items.length === 0) return null;

            return (
              <Card key={group.key}>
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.label}
                  </h2>
                  <span className="text-xs text-subtle">{items.length}</span>
                </div>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="block px-4 py-2.5 transition-colors hover:bg-surface-hover/60"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        {item.subtitle ? (
                          <p className="truncate text-xs text-muted">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          {GROUPS.every((group) => (results?.[group.key] ?? []).length === 0) ? (
            <Card>
              <EmptyState
                title={`No matches for “${q}”`}
                description="Try a shorter term, a company name, or a person's name."
              />
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
