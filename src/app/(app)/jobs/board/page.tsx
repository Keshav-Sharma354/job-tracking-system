import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listAllJobs } from "@/server/repo/jobs";
import { listAllCompanies } from "@/server/repo/companies";
import { listResumeVersions } from "@/server/repo/activity";
import { listContacts } from "@/server/repo/contacts";
import { PageHeader } from "@/components/ui/layout";
import { NewJobButton } from "@/components/features/jobs/job-form-dialog";
import { KanbanBoard } from "@/components/features/jobs/kanban-board";
import { captureNow } from "@/lib/utils/clock";
import type { JobFormOptions } from "@/components/features/jobs/job-form-fields";

export const metadata: Metadata = { title: "Kanban board" };

export default async function BoardPage() {
  const session = await requireSession();
  const userId = session.userId;

  const [jobs, companies, resumes, contacts] = await Promise.all([
    listAllJobs(userId, { sort: "updatedAt", direction: "desc" }),
    listAllCompanies(userId),
    listResumeVersions(userId),
    listContacts(userId, { pageSize: 100 }),
  ]);

  const columns: Record<string, typeof jobs> = {};
  for (const job of jobs) {
    (columns[job.status] ??= []).push(job);
  }

  const formOptions: JobFormOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    resumeVersions: resumes.map((r) => ({ id: r.id, label: r.label })),
    referralContacts: contacts.items.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kanban board"
        description="Drag a card to move it through your pipeline."
        actions={<NewJobButton options={formOptions} />}
      />
      <KanbanBoard
        columns={columns}
        timezone={session.user.timezone}
        now={captureNow()}
      />
    </div>
  );
}
