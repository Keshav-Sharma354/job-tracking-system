import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Flame,
  MailCheck,
} from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/badge";
import { APPLICATION_STATUS_ORDER, STATUS_META } from "@/lib/constants";
import { formatRelativeDue } from "@/lib/utils/date";
import type { PipelineCounts } from "@/server/services/analytics";

/**
 * A single headline metric. The trend line is deliberately omitted: with a
 * personal job search there is rarely enough history for a trend to mean
 * anything, and a misleading sparkline is worse than none.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneRing = {
    neutral: "bg-surface-sunken text-muted",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-destructive-subtle text-destructive",
    success: "bg-success-subtle text-success",
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">
          {label}
        </p>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${toneRing}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-card border border-border bg-surface p-4 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-hover"
      >
        {content}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          View <ArrowRight className="size-3" />
        </span>
      </Link>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      {content}
    </div>
  );
}

/** Horizontal stage-by-stage breakdown of the pipeline. */
export function PipelineSummary({ counts }: { counts: PipelineCounts }) {
  const max = Math.max(1, ...Object.values(counts.byStatus));

  return (
    <Card>
      <CardHeader
        title="Pipeline"
        description={`${counts.active} active of ${counts.total} tracked`}
        action={
          <Link
            href="/jobs/board"
            className="text-xs font-medium text-accent hover:underline"
          >
            Board
          </Link>
        }
      />
      <CardBody className="space-y-2.5">
        {APPLICATION_STATUS_ORDER.filter(
          (status) => (counts.byStatus[status] ?? 0) > 0,
        ).map((status) => {
          const meta = STATUS_META[status];
          const value = counts.byStatus[status] ?? 0;
          return (
            <div key={status} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <StatusBadge label={meta.label} className={meta.badge} />
              </div>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={`h-full rounded-full ${meta.accent}`}
                  style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                />
              </div>
              <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-muted">
                {value}
              </span>
            </div>
          );
        })}

        {counts.total === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title="No applications yet"
            description="Add your first role to start tracking your search."
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

export interface UpcomingInterview {
  id: string;
  title: string;
  dueAt: Date | null;
  job: { id: string; title: string; company: { name: string } } | null;
  contact: { id: string; name: string } | null;
}

export function UpcomingInterviews({
  interviews,
  timeZone,
}: {
  interviews: UpcomingInterview[];
  timeZone: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Upcoming interviews"
        description="Next 14 days"
        action={
          <CalendarCheck className="size-4 text-subtle" aria-hidden />
        }
      />
      <CardBody className="flex-1 p-0">
        {interviews.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-5" />}
            title="Nothing scheduled"
            description="Add an interview task and it will show up here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {interviews.map((interview) => (
              <li key={interview.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {interview.job?.title ?? interview.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {interview.job?.company.name ?? "—"}
                      {interview.contact ? ` · ${interview.contact.name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-accent-subtle px-1.5 py-0.5 text-[0.6875rem] font-medium text-accent">
                    {formatRelativeDue(interview.dueAt, new Date(), timeZone)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function FollowUpList({
  tasks,
  timeZone,
  emptyTitle,
  emptyDescription,
}: {
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    taskType: string;
    job: { id: string; title: string; company: { name: string } } | null;
    contact: { id: string; name: string } | null;
  }>;
  timeZone: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (tasks.length === 0) {
    return (
      <Card className="flex flex-col">
        <CardBody className="flex-1">
          <EmptyState
            icon={<MailCheck className="size-5" />}
            title={emptyTitle}
            description={emptyDescription}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardBody className="flex-1 p-0">
        <ul className="divide-y divide-border">
          {tasks.map((task) => {
            const overdue = task.dueAt !== null && task.dueAt < startOfToday();
            return (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-1 size-1.5 shrink-0 rounded-full ${
                    overdue ? "bg-destructive" : "bg-subtle"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{task.title}</p>
                  <p className="truncate text-xs text-muted">
                    {task.job
                      ? `${task.job.title} · ${task.job.company.name}`
                      : task.contact
                        ? task.contact.name
                        : "General"}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    overdue ? "text-destructive" : "text-subtle"
                  }`}
                >
                  {formatRelativeDue(task.dueAt, new Date(), timeZone)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function OverdueIcon() {
  return <Flame className="size-4" />;
}
