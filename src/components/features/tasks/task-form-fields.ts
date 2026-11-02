import type { FieldSpec } from "@/components/ui/resource-form";
import { TASK_PRIORITY_LABELS, TASK_TYPE_LABELS } from "@/lib/constants";
import { toDateTimeInputValue } from "@/lib/utils/date";

export interface TaskFormOptions {
  jobs: { id: string; label: string }[];
  contacts: { id: string; label: string }[];
}

export function taskFormFields(
  defaults: {
    title?: string | null;
    description?: string | null;
    taskType?: string | null;
    status?: string | null;
    priority?: string | null;
    dueAt?: Date | string | null;
    jobId?: string | null;
    contactId?: string | null;
    emailId?: string | null;
  } = {},
  options: TaskFormOptions,
): FieldSpec[] {
  return [
    {
      name: "title",
      label: "Task",
      type: "text",
      required: true,
      span: 12,
      placeholder: "e.g. Follow up with Amara about the screen",
      defaultValue: defaults.title ?? "",
    },
    {
      name: "taskType",
      label: "Type",
      type: "select",
      span: 4,
      defaultValue: defaults.taskType ?? "FOLLOW_UP",
      options: Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      span: 4,
      defaultValue: defaults.priority ?? "MEDIUM",
      options: Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      span: 4,
      defaultValue: defaults.status ?? "OPEN",
      options: [
        { value: "OPEN", label: "Open" },
        { value: "DONE", label: "Done" },
        { value: "CANCELLED", label: "Cancelled" },
      ],
    },
    {
      name: "dueAt",
      label: "Due",
      type: "datetime-local",
      span: 6,
      defaultValue: toDateTimeInputValue(defaults.dueAt ?? null) || null,
    },
    {
      name: "jobId",
      label: "Related application",
      type: "select",
      span: 6,
      placeholder: "Not linked",
      defaultValue: defaults.jobId ?? "",
      options: options.jobs.map((job) => ({ value: job.id, label: job.label })),
    },
    {
      name: "contactId",
      label: "Related contact",
      type: "select",
      span: 6,
      placeholder: "Not linked",
      defaultValue: defaults.contactId ?? "",
      options: options.contacts.map((c) => ({ value: c.id, label: c.label })),
    },
    {
      name: "description",
      label: "Details",
      type: "textarea",
      span: 12,
      placeholder: "Anything you need to remember before doing this.",
      defaultValue: defaults.description ?? "",
    },
  ];
}
