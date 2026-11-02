import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listAllJobs } from "@/server/repo/jobs";
import { listContacts } from "@/server/repo/contacts";
import { PageHeader } from "@/components/ui/layout";
import { nowDateTimeInputValue } from "@/lib/utils/date";
import { NewTaskClient } from "./new-task-client";
import type { TaskFormOptions } from "@/components/features/tasks/task-form-fields";

export const metadata: Metadata = { title: "New follow-up" };

export default async function NewTaskPage() {
  const session = await requireSession();

  const [jobs, contacts] = await Promise.all([
    listAllJobs(session.userId),
    listContacts(session.userId, { pageSize: 100 }),
  ]);

  const options: TaskFormOptions = {
    jobs: jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.company.name}` })),
    contacts: contacts.items.map((c) => ({ id: c.id, label: c.name })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="New follow-up"
        description="Reminders for applications, contacts and replies."
      />
      <NewTaskClient options={options} defaultDueDate={nowDateTimeInputValue(1)} />
    </div>
  );
}

