"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { TaskFormDialog } from "@/components/features/tasks/task-form-dialog";
import { DeleteButton } from "@/components/features/common/delete-button";
import { toggleTaskAction, snoozeTaskAction, deleteTaskAction } from "@/app/actions/crm";
import {
  TASK_PRIORITY_BADGES,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/constants";
import { dueState, formatDateTime, formatRelativeDue } from "@/lib/utils/date";
import type { TaskFormOptions } from "./task-form-fields";

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  jobId: string | null;
  job: { id: string; title: string; company: { name: string } } | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
}

const DUE_TONE: Record<string, string> = {
  overdue: "text-destructive font-medium",
  today: "text-warning font-medium",
  tomorrow: "text-muted",
  upcoming: "text-muted",
  later: "text-subtle",
};

export function TaskList({
  tasks,
  timezone,
  formOptions,
}: {
  tasks: TaskListItem[];
  timezone: string;
  formOptions: TaskFormOptions;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<TaskListItem | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(task: TaskListItem) {
    setBusy(task.id);
    try {
      await toggleTaskAction(task.id, task.status !== "DONE");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function snooze(task: TaskListItem, days: number) {
    setBusy(task.id);
    try {
      await snoozeTaskAction(task.id, days);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {tasks.map((task) => {
          const done = task.status === "DONE";
          const state = task.dueAt ? dueState(task.dueAt, new Date(), timezone) : null;

          return (
            <li
              key={task.id}
              className={cn(
                "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60",
                busy === task.id && "pointer-events-none opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(task)}
                aria-pressed={done}
                aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  done
                    ? "border-success bg-success text-white"
                    : "border-border-strong hover:border-accent",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3.5} /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "text-sm",
                      done
                        ? "text-subtle line-through"
                        : "font-medium text-foreground",
                    )}
                  >
                    {task.title}
                  </span>
                  <StatusBadge
                    label={TASK_TYPE_LABELS[task.taskType as keyof typeof TASK_TYPE_LABELS]}
                  />
                  <StatusBadge
                    label={TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS]}
                    className={TASK_PRIORITY_BADGES[task.priority as never]}
                  />
                </div>

                {task.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {task.description}
                  </p>
                ) : null}

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  {task.job ? (
                    <Link
                      href={`/jobs/${task.job.id}`}
                      className="text-muted hover:text-accent hover:underline"
                    >
                      {task.job.title} · {task.job.company.name}
                    </Link>
                  ) : null}
                  {task.contact ? (
                    <Link
                      href={`/contacts/${task.contact.id}`}
                      className="text-muted hover:text-accent hover:underline"
                    >
                      {task.contact.name}
                    </Link>
                  ) : null}
                  {task.dueAt ? (
                    <span className={DUE_TONE[state ?? "later"]}>
                      {done
                        ? formatDateTime(task.dueAt)
                        : formatRelativeDue(task.dueAt, new Date(), timezone)}
                    </span>
                  ) : (
                    <span className="text-subtle">No due date</span>
                  )}
                </div>
              </div>

              {!done && task.dueAt ? (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => snooze(task, 1)}
                    title="Postpone by one day"
                  >
                    +1d
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => snooze(task, 7)}
                    title="Postpone by one week"
                  >
                    +1w
                  </Button>
                </div>
              ) : null}

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing(task)}
                  aria-label={`Edit ${task.title}`}
                >
                  <Pencil />
                </Button>
                <DeleteButton
                  entityName="task"
                  onDelete={() => deleteTaskAction(task.id)}
                  size="icon-sm"
                />
              </div>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <TaskFormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          taskId={editing.id}
          options={formOptions}
          defaults={{
            title: editing.title,
            description: editing.description,
            taskType: editing.taskType,
            status: editing.status,
            priority: editing.priority,
            dueAt: editing.dueAt,
            jobId: editing.jobId,
            contactId: editing.contactId,
          }}
        />
      ) : null}
    </>
  );
}
