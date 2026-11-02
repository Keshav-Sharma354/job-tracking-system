import { Briefcase, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  EMPLOYMENT_TYPE_LABELS,
  PRIORITY_BADGES,
  PRIORITY_LABELS,
  STATUS_META,
  WORK_MODE_LABELS,
} from "@/lib/constants";
import { formatRelativeDue } from "@/lib/utils/date";
import { LabelBadge, StatusBadge } from "@/components/ui/badge";
import type { JobListItem } from "@/server/repo/jobs";

/** Compact card used by the Kanban board. */
export function JobCard({
  job,
  timezone,
  now,
  onDragStart,
  isDragging,
}: {
  job: JobListItem;
  timezone: string;
  /**
   * Timestamp captured once on the server and threaded down, so every card on a
   * page agrees on "now" and rendering stays pure.
   */
  now: number;
  onDragStart?: (event: React.DragEvent) => void;
  isDragging?: boolean;
}) {
  const deadlineSoon =
    job.deadlineAt !== null &&
    job.deadlineAt.getTime() - now < 3 * 24 * 60 * 60 * 1000;

  return (
    <div
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      className={cn(
        "group rounded-lg border border-border bg-surface p-3 shadow-sm",
        "transition-shadow hover:shadow-md",
        onDragStart && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/jobs/${job.id}`}
          className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground hover:text-accent"
        >
          <span className="line-clamp-2">{job.title}</span>
        </Link>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the ${job.title} posting in a new tab`}
            className="shrink-0 rounded p-0.5 text-subtle opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      <p className="mt-1 truncate text-xs text-muted">{job.company.name}</p>

      {job.location ? (
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-subtle">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{job.location}</span>
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {job.priority === "HIGH" ? (
          <StatusBadge
            label={PRIORITY_LABELS[job.priority]}
            className={PRIORITY_BADGES[job.priority]}
          />
        ) : null}
        {job.workMode ? (
          <StatusBadge
            label={WORK_MODE_LABELS[job.workMode]}
            className="bg-surface-sunken text-muted ring-border"
          />
        ) : null}
        {job.deadlineAt ? (
          <span
            className={cn(
              "text-[0.6875rem] font-medium",
              deadlineSoon ? "text-destructive" : "text-subtle",
            )}
          >
            Due {formatRelativeDue(new Date(job.deadlineAt), new Date(now), timezone)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Table row used by the applications list. */
export function JobRow({
  job,
  timezone,
  now,
}: {
  job: JobListItem;
  timezone: string;
  now: number;
}) {
  const meta = STATUS_META[job.status];

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-surface-hover/60">
      <td className="px-4 py-3">
        <Link
          href={`/jobs/${job.id}`}
          className="block min-w-0 max-w-xs focus-visible:outline-none"
        >
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-accent">
            {job.title}
          </span>
          <span className="block truncate text-xs text-muted">
            {job.company.name}
          </span>
        </Link>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <StatusBadge label={meta.label} className={meta.badge} />
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <span className="text-sm text-muted">{job.location ?? "—"}</span>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <span className="text-sm tabular-nums text-muted">
          {job.salaryMin ? `${compactSalary(job.salaryMin, job.salaryCurrency)}` : "—"}
          {job.salaryMax
            ? ` – ${compactSalary(job.salaryMax, job.salaryCurrency)}`
            : ""}
        </span>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <StatusBadge
          label={PRIORITY_LABELS[job.priority]}
          className={PRIORITY_BADGES[job.priority]}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-muted">
          {job.deadlineAt
            ? formatRelativeDue(new Date(job.deadlineAt), new Date(now), timezone)
            : "—"}
        </span>
      </td>
    </tr>
  );
}

function compactSalary(value: number, currency: string | null): string {
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${symbol}${Math.round(value / 1000)}k`;
}

export { Briefcase, EMPLOYMENT_TYPE_LABELS, LabelBadge };
