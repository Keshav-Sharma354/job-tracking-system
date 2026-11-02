import type { Metadata } from "next";
import Link from "next/link";
import {
  Briefcase,
  CalendarCheck,
  Flame,
  Inbox,
  Send,
  Sparkles,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTaskCounts, listTasks } from "@/server/repo/tasks";
import * as analytics from "@/server/services/analytics";
import { listActivity } from "@/server/repo/activity";
import { formatRelativeDue } from "@/lib/utils/date";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import {
  FollowUpList,
  PipelineSummary,
  StatCard,
  UpcomingInterviews,
} from "@/components/features/dashboard/widgets";
import { ActivityFeed } from "@/components/features/dashboard/activity-feed";
import { EmptyDashboard } from "@/components/features/dashboard/empty-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.userId;
  const timezone = session.user.timezone;

  const [stats, pipeline, counts, interviews, overdue, today, upcoming, activity] =
    await Promise.all([
      analytics.getDashboardStats(userId),
      analytics.getPipelineCounts(userId),
      getTaskCounts(userId),
      analytics.getUpcomingInterviews(userId, 14),
      listTasks(userId, { bucket: "overdue", pageSize: 6 }),
      listTasks(userId, { bucket: "today", pageSize: 6 }),
      listTasks(userId, { bucket: "upcoming", pageSize: 6 }),
      listActivity(userId, { pageSize: 8 }),
    ]);

  // A brand-new account gets a walkthrough instead of an empty grid of zeroes.
  if (pipeline.total === 0 && counts.all === 0) {
    return <EmptyDashboard name={session.user.name} />;
  }

  const interviewRate = Math.round(stats.interviewRate * 100);
  const replyRate = Math.round(stats.emailReplyRate * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName(session.user.name)}`}
        description="Here's where your search stands today."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/jobs/board">Open board</Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                <Briefcase />
                Add application
              </Link>
            </Button>
          </>
        }
      />

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Active applications"
          value={stats.activeApplications}
          hint={`${stats.totalApplications} tracked in total`}
          href="/jobs"
          icon={<Briefcase className="size-4" />}
        />
        <StatCard
          label="Interviews this week"
          value={stats.interviewsThisWeek}
          hint={stats.offers > 0 ? `${stats.offers} offer(s) open` : undefined}
          href="/tasks"
          icon={<CalendarCheck className="size-4" />}
          tone={stats.interviewsThisWeek > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Overdue follow-ups"
          value={counts.overdue}
          hint={counts.overdue > 0 ? "Needs attention" : "All caught up"}
          href="/tasks?bucket=overdue"
          icon={<Flame className="size-4" />}
          tone={counts.overdue > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Reply rate"
          value={`${replyRate}%`}
          hint={`${interviewRate}% of applications reached an interview`}
          href="/reports"
          icon={<Send className="size-4" />}
          tone={replyRate >= 10 ? "success" : "neutral"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PipelineSummary counts={pipeline} />
        </div>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <UpcomingInterviews interviews={interviews} timeZone={timezone} />

          <Card className="flex flex-col">
            <CardHeader
              title="Needs attention"
              description={
                counts.overdue > 0
                  ? `${counts.overdue} overdue · ${counts.today} due today`
                  : `${counts.today} due today`
              }
              action={
                <Link
                  href="/tasks"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  All
                </Link>
              }
            />
            <CardBody className="flex-1 p-0">
              {overdue.items.length === 0 && today.items.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="size-5" />}
                  title="Nothing outstanding"
                  description="Follow-ups created from applications and emails will appear here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {[...overdue.items, ...today.items].slice(0, 6).map((task) => (
                    <TaskRow key={task.id} task={task} timezone={timezone} />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent activity"
              description="Everything you have done lately"
              action={<Inbox className="size-4 text-subtle" aria-hidden />}
            />
            <CardBody className="p-0">
              {activity.items.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="size-5" />}
                  title="No activity yet"
                  description="Changes you make will be logged here."
                />
              ) : (
                <ActivityFeed items={activity.items} />
              )}
            </CardBody>
          </Card>
        </div>

        <FollowUpList
          tasks={upcoming.items}
          timeZone={timezone}
          emptyTitle="Nothing scheduled"
          emptyDescription="Upcoming follow-ups will appear here."
        />
      </div>
    </div>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function TaskRow({
  task,
  timezone,
}: {
  task: {
    id: string;
    title: string;
    dueAt: Date | null;
    job: { id: string; title: string; company: { name: string } } | null;
    contact: { id: string; name: string } | null;
  };
  timezone: string;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {task.title}
          </p>
          <p className="truncate text-xs text-muted">
            {task.job
              ? `${task.job.title} · ${task.job.company.name}`
              : task.contact
                ? task.contact.name
                : "General"}
          </p>
        </div>
        <Link
          href="/tasks"
          className="shrink-0 text-xs font-medium text-accent hover:underline"
        >
          {formatRelativeDue(task.dueAt, new Date(), timezone)}
        </Link>
      </div>
    </li>
  );
}
