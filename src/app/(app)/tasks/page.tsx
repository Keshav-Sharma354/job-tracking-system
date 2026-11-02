import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTaskCounts, listTasks } from "@/server/repo/tasks";
import { listAllJobs } from "@/server/repo/jobs";
import { listContacts } from "@/server/repo/contacts";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { NewTaskButton } from "@/components/features/tasks/task-form-dialog";
import { TaskList } from "@/components/features/tasks/task-list";
import type { TaskFormOptions } from "@/components/features/tasks/task-form-fields";

export const metadata: Metadata = { title: "Follow-ups" };

const BUCKETS = ["overdue", "today", "upcoming", "done", "all"] as const;
type Bucket = (typeof BUCKETS)[number];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";

  const rawBucket = first(params.bucket);
  const bucket: Bucket = BUCKETS.includes(rawBucket as Bucket)
    ? (rawBucket as Bucket)
    : "all";
  const jobId = first(params.jobId);

  const [counts, result, jobs, contacts] = await Promise.all([
    getTaskCounts(session.userId),
    listTasks(session.userId, {
      bucket: bucket === "all" ? "all" : bucket,
      jobId: jobId || undefined,
      pageSize: 100,
    }),
    listAllJobs(session.userId),
    listContacts(session.userId, { pageSize: 100 }),
  ]);

  const options: TaskFormOptions = {
    jobs: jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.company.name}` })),
    contacts: contacts.items.map((c) => ({ id: c.id, label: c.name })),
  };

  const countsByBucket: Record<Bucket, number> = {
    overdue: counts.overdue,
    today: counts.today,
    upcoming: counts.upcoming,
    done: counts.done,
    all: counts.all,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description={
          counts.overdue > 0
            ? `${counts.overdue} overdue and ${counts.today} due today`
            : "Everything you have scheduled"
        }
        actions={
          <NewTaskButton
            options={options}
            defaults={{ jobId: jobId || null, dueAt: defaultDueDate() }}
          />
        }
      />

      <nav aria-label="Task filters" className="flex flex-wrap gap-1.5">
        {BUCKETS.map((value) => (
          <Link
            key={value}
            href={`/tasks?bucket=${value}`}
            aria-current={bucket === value ? "page" : undefined}
            className={
              bucket === value
                ? "rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm"
                : "rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-border transition-colors hover:bg-surface-hover hover:text-foreground"
            }
          >
            {value === "all" ? "All" : capitalise(value)}{" "}
            <span
              className={
                bucket === value ? "opacity-80" : "text-subtle"
              }
            >
              {countsByBucket[value]}
            </span>
          </Link>
        ))}
      </nav>

      {jobId ? (
        <p className="rounded-lg bg-accent-subtle px-3 py-2 text-sm text-accent">
          Showing tasks linked to one application.{" "}
          <Link href="/tasks" className="font-medium underline">
            Show all
          </Link>
        </p>
      ) : null}

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-5" />}
            title={
              bucket === "overdue"
                ? "Nothing overdue"
                : bucket === "today"
                  ? "Nothing due today"
                  : "No tasks here"
            }
            description={
              bucket === "overdue" || bucket === "today"
                ? "That is the point — you are on top of it."
                : "Follow-ups are created automatically when you apply, send an email or receive a reply."
            }
            action={
              bucket === "all" ? <NewTaskButton options={options} /> : undefined
            }
          />
        ) : (
          <TaskList
            tasks={result.items}
            timezone={session.user.timezone}
            formOptions={options}
          />
        )}
      </Card>
    </div>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function defaultDueDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}
