"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Link2,
  MapPin,
  Pencil,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow, EmptyState } from "@/components/ui/layout";
import { LabelBadge, StatusBadge } from "@/components/ui/badge";
import { JobFormDialog } from "@/components/features/jobs/job-form-dialog";
import { DeleteButton } from "@/components/features/common/delete-button";
import { NoteComposer } from "@/components/features/notes/note-composer";
import { TaskQuickAdd } from "@/components/features/tasks/task-quick-add";
import { deleteJobAction, moveJobAction } from "@/app/actions/jobs";
import { APPLICATION_STATUSES, STATUS_META } from "@/lib/constants";
import { formatRelativeDue } from "@/lib/utils/date";
import type { JobFormOptions } from "./job-form-fields";

export interface JobDetailViewProps {
  job: {
    id: string;
    title: string;
    url: string | null;
    location: string | null;
    notes: string | null;
    tags: string[];
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    appliedAt: Date | null;
    appliedAtLabel: string;
    deadlineAt: Date | null;
    deadlineLabel: string;
    updatedAtLabel: string;
    status: string;
    statusLabel: string;
    statusBadgeClass: string;
    employmentTypeLabel: string;
    workMode: string | null;
    workModeLabel: string | null;
    priority: string;
    priorityLabel: string;
    priorityBadgeClass: string;
    company: { id: string; name: string; websiteUrl: string | null };
    resumeVersion: { id: string; label: string } | null;
    referralContact: { id: string; name: string } | null;
    _count: { noteRecords: number; emails: number; tasks: number; statusEvents: number };
  };
  statusEvents: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    fromLabel: string | null;
    toLabel: string;
    note: string | null;
    createdLabel: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    noteType: string;
    isPinned: boolean;
    createdAt: Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    status: string;
    taskType: string;
  }>;
  formOptions: JobFormOptions;
  timezone: string;
}

export function JobDetailView(props: JobDetailViewProps) {
  const { job } = props;
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [moving, setMoving] = React.useState(false);

  async function changeStatus(status: string) {
    if (status === job.status) return;
    setMoving(true);
    try {
      const result = await moveJobAction({
        jobId: job.id,
        status: status as never,
      });
      if (!result.ok && result.code !== "VALIDATION") {
        console.error(result.error);
      }
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  const salary =
    job.salaryMin || job.salaryMax
      ? `${formatSalary(job.salaryMin, job.salaryCurrency)}${
          job.salaryMax ? ` – ${formatSalary(job.salaryMax, job.salaryCurrency)}` : ""
        }`
      : null;

  const openTasks = props.tasks.filter((t) => t.status === "OPEN");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={job.statusLabel} className={job.statusBadgeClass} />
            <StatusBadge label={job.priorityLabel} className={job.priorityBadgeClass} />
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {job.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <Link
              href={`/companies/${job.company.id}`}
              className="inline-flex items-center gap-1 font-medium hover:text-accent hover:underline"
            >
              <Building2 className="size-3.5" aria-hidden />
              {job.company.name}
            </Link>
            {job.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {job.location}
              </span>
            ) : null}
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-accent hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Posting
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <DeleteButton
            entityName={job.title}
            description={`Deleting this application also removes its notes, emails and follow-ups. This cannot be undone.`}
            onDelete={() => deleteJobAction(job.id)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Stage control */}
          <Card>
            <CardHeader title="Stage" description="Change this to update the timeline" />
            <CardBody>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Application stage"
              >
                {APPLICATION_STATUSES.map((status) => {
                  const meta = STATUS_META[status];
                  const active = status === job.status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={moving}
                      aria-pressed={active}
                      onClick={() => changeStatus(status)}
                      className={
                        active
                          ? `rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.badge}`
                          : "rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                      }
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader
              title="Notes"
              description="Interview write-ups, research and context"
              action={
                <span className="text-xs text-subtle">
                  {job._count.noteRecords} total
                </span>
              }
            />
            <CardBody className="space-y-3">
              <NoteComposer jobId={job.id} />

              {props.notes.length === 0 ? (
                <EmptyState
                  icon={<StickyNote className="size-5" />}
                  title="No notes yet"
                  description="Capture what you learned — it is the thing you will want before the next round."
                />
              ) : (
                <ul className="space-y-2.5">
                  {props.notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-border bg-surface-sunken p-3"
                    >
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {note.body}
                      </p>
                      <p className="mt-1.5 text-xs text-subtle">
                        {note.noteType.toLowerCase().replace(/_/g, " ")} ·{" "}
                        {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* History */}
          <Card>
            <CardHeader
              title="History"
              description="Every stage this application has been through"
            />
            <CardBody>
              {props.statusEvents.length === 0 ? (
                <EmptyState
                  icon={<Clock className="size-5" />}
                  title="No transitions recorded"
                />
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {props.statusEvents.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full bg-accent ring-4 ring-surface"
                        aria-hidden
                      />
                      <p className="text-sm text-foreground">
                        {event.fromLabel ? (
                          <>
                            <span className="text-muted">{event.fromLabel}</span>
                            {" → "}
                            <span className="font-medium">{event.toLabel}</span>
                          </>
                        ) : (
                          <span className="font-medium">Created as {event.toLabel}</span>
                        )}
                      </p>
                      {event.note ? (
                        <p className="mt-0.5 text-sm text-muted">{event.note}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-subtle">{event.createdLabel}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailRow label="Applied">{job.appliedAtLabel}</DetailRow>
                <DetailRow label="Deadline">{job.deadlineLabel}</DetailRow>
                <DetailRow label="Type">{job.employmentTypeLabel}</DetailRow>
                <DetailRow label="Work mode">{job.workModeLabel ?? "—"}</DetailRow>
                <DetailRow label="Salary">{salary ?? "—"}</DetailRow>
                <DetailRow label="Resume">{job.resumeVersion?.label ?? "—"}</DetailRow>
                <DetailRow label="Referred by">
                  {job.referralContact ? (
                    <Link
                      href={`/contacts/${job.referralContact.id}`}
                      className="inline-flex items-center gap-1 hover:text-accent hover:underline"
                    >
                      <Link2 className="size-3.5" aria-hidden />
                      {job.referralContact.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Emails">{job._count.emails}</DetailRow>
              </dl>
            </CardBody>
          </Card>

          {job.tags.length > 0 ? (
            <Card>
              <CardHeader title="Tags" />
              <CardBody className="flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <LabelBadge key={tag} seed={tag}>
                    {tag}
                  </LabelBadge>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Follow-ups"
              description={`${openTasks.length} open`}
              action={
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={`/tasks?jobId=${job.id}`}>
                    <Plus />
                  </Link>
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <TaskQuickAdd jobId={job.id} />
              {props.tasks.length === 0 ? (
                <EmptyState
                  icon={<Calendar className="size-5" />}
                  title="Nothing scheduled"
                  description="Add a reminder so this does not slip."
                />
              ) : (
                <ul className="space-y-2">
                  {props.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2.5">
                      {task.status === "DONE" ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <Clock className="mt-0.5 size-4 shrink-0 text-subtle" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            task.status === "DONE"
                              ? "text-sm text-subtle line-through"
                              : "text-sm text-foreground"
                          }
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-subtle">
                          {task.dueAt
                            ? formatRelativeDue(task.dueAt, new Date(), props.timezone)
                            : "No due date"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {job.notes ? (
            <Card>
              <CardHeader
                title="Application notes"
                action={<FileText className="size-4 text-subtle" aria-hidden />}
              />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {job.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <JobFormDialog
        open={editing}
        onOpenChange={setEditing}
        jobId={job.id}
        options={props.formOptions}
        defaults={{
          companyId: job.company.id,
          title: job.title,
          url: job.url,
          location: job.location,
          employmentType: "FULL_TIME",
          workMode: job.workMode,
          status: job.status,
          priority: job.priority,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryPeriod: "YEAR",
          appliedAt: job.appliedAt,
          deadlineAt: job.deadlineAt,
          referralContactId: job.referralContact?.id ?? null,
          resumeVersionId: job.resumeVersion?.id ?? null,
          notes: job.notes,
          tags: job.tags,
        }}
      />
    </div>
  );
}

function formatSalary(value: number | null, currency: string): string {
  if (value === null) return "";
  const symbol =
    currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-US")}`;
}
