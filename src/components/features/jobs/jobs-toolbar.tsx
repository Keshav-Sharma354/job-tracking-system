"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APPLICATION_STATUSES, PRIORITY_LABELS, STATUS_META } from "@/lib/constants";
import { buildQuery } from "@/lib/utils/date";

export interface JobsFilterState {
  q: string;
  status: string;
  companyId: string;
  priority: string;
  sort: string;
  direction: string;
  page: number;
}

/**
 * Filter bar that writes to the URL rather than to local state.
 *
 * Keeping the query in the URL means a filtered view can be bookmarked, shared
 * and survived by a refresh, and the server component always receives the exact
 * query that produced the rendered rows.
 */
/**
 * Free-text filter.
 *
 * Owns its own local state as a leaf component and reports changes upwards, so
 * the toolbar stays a pure function of the URL and no effect is needed to keep
 * the input in step with it.
 */
function SearchBox({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [term, setTerm] = React.useState(value);

  return (
    <div className="relative min-w-48 flex-1 sm:max-w-xs">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
      />
      <input
        // Remount when the committed value changes from elsewhere (e.g. Clear),
        // so the input always reflects the URL without a syncing effect.
        key={value}
        type="search"
        defaultValue={value}
        placeholder="Search roles…"
        aria-label="Search applications"
        className="flex h-9 w-full rounded-lg border border-input bg-surface-sunken pl-8 pr-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-subtle focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(term);
          }
        }}
        onBlur={() => {
          if (term !== value) onCommit(term);
        }}
      />
    </div>
  );
}

export function JobsToolbar({
  filters,
  companies,
}: {
  filters: JobsFilterState;
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const hasFilters =
    filters.q || filters.status || filters.companyId || filters.priority;

  function apply(changes: Partial<JobsFilterState>) {
    const next = { ...filters, ...changes, page: 1 };
    router.push(`${pathname}${buildQuery({
      q: next.q,
      status: next.status,
      companyId: next.companyId,
      priority: next.priority,
      sort: next.sort === "updatedAt" ? "" : next.sort,
      direction: next.direction === "desc" ? "" : next.direction,
    })}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox value={filters.q} onCommit={(q) => apply({ q })} />

      <Select
        aria-label="Filter by stage"
        className="w-auto min-w-36"
        value={filters.status}
        onChange={(event) => apply({ status: event.target.value })}
      >
        <option value="">All stages</option>
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_META[status].label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by company"
        className="w-auto min-w-40"
        value={filters.companyId}
        onChange={(event) => apply({ companyId: event.target.value })}
      >
        <option value="">All companies</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by priority"
        className="w-auto min-w-32"
        value={filters.priority}
        onChange={(event) => apply({ priority: event.target.value })}
      >
        <option value="">Any priority</option>
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Sort order"
        className="w-auto min-w-36"
        value={`${filters.sort}:${filters.direction}`}
        onChange={(event) => {
          const [sort, direction] = event.target.value.split(":");
          apply({ sort: sort ?? "updatedAt", direction: direction ?? "desc" });
        }}
      >
        <option value="updatedAt:desc">Recently updated</option>
        <option value="deadlineAt:asc">Deadline, soonest</option>
        <option value="appliedAt:desc">Newest applications</option>
        <option value="companyId:asc">Company A–Z</option>
        <option value="title:asc">Role A–Z</option>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
