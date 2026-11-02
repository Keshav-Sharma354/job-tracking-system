import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession, requireSession } from "@/lib/auth/session";
import { getJobById, listStatusEvents } from "@/server/repo/jobs";
import { listNotesForJob } from "@/server/repo/notes";
import { listTasks } from "@/server/repo/tasks";
import { listAllCompanies } from "@/server/repo/companies";
import { listResumeVersions } from "@/server/repo/activity";
import { listContacts } from "@/server/repo/contacts";
import {
  EMPLOYMENT_TYPE_LABELS,
  PRIORITY_BADGES,
  PRIORITY_LABELS,
  STATUS_META,
  WORK_MODE_LABELS,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { JobDetailView } from "@/components/features/jobs/job-detail-view";
import type { JobFormOptions } from "@/components/features/jobs/job-form-fields";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session) return { title: "Application" };

  const job = await getJobById(session.userId, id);
  if (!job) return { title: "Application not found" };

  return {
    title: `${job.title} · ${job.company.name}`,
    description: job.notes?.slice(0, 160) ?? undefined,
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [job, statusEvents, notes, tasks, companies, resumes, contacts] =
    await Promise.all([
      getJobById(session.userId, id),
      listStatusEvents(session.userId, id),
      listNotesForJob(session.userId, id),
      listTasks(session.userId, { jobId: id, pageSize: 50 }),
      listAllCompanies(session.userId),
      listResumeVersions(session.userId),
      listContacts(session.userId, { pageSize: 100 }),
    ]);

  if (!job) notFound();

  const formOptions: JobFormOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    resumeVersions: resumes.map((r) => ({ id: r.id, label: r.label })),
    referralContacts: contacts.items.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <JobDetailView
      job={{
        ...job,
        statusLabel: STATUS_META[job.status].label,
        statusBadgeClass: STATUS_META[job.status].badge,
        employmentTypeLabel: EMPLOYMENT_TYPE_LABELS[job.employmentType],
        workMode: job.workMode,
        workModeLabel: job.workMode ? WORK_MODE_LABELS[job.workMode] : null,
        priority: job.priority,
        priorityLabel: PRIORITY_LABELS[job.priority],
        priorityBadgeClass: PRIORITY_BADGES[job.priority],
        appliedAt: job.appliedAt,
        appliedAtLabel: formatDate(job.appliedAt),
        deadlineAt: job.deadlineAt,
        deadlineLabel: formatDate(job.deadlineAt),
        updatedAtLabel: formatDateTime(job.updatedAt),
      }}
      statusEvents={statusEvents.map((event) => ({
        ...event,
        fromLabel: event.fromStatus ? STATUS_META[event.fromStatus].label : null,
        toLabel: STATUS_META[event.toStatus].label,
        createdLabel: formatDateTime(event.createdAt),
      }))}
      notes={notes}
      tasks={tasks.items}
      formOptions={formOptions}
      timezone={session.user.timezone}
    />
  );
}
