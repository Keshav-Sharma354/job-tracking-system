import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listAllCompanies } from "@/server/repo/companies";
import { listResumeVersions } from "@/server/repo/activity";
import { listContacts } from "@/server/repo/contacts";
import { PageHeader } from "@/components/ui/layout";
import { JobFormDialog } from "@/components/features/jobs/job-form-dialog";
import type { JobFormOptions } from "@/components/features/jobs/job-form-fields";

export const metadata: Metadata = { title: "New application" };

/**
 * Dedicated route for the create form so the dialog is reachable from a
 * bookmark or an empty-state link, and so the page has its own metadata.
 */
export default async function NewJobPage() {
  const session = await requireSession();

  const [companies, resumes, contacts] = await Promise.all([
    listAllCompanies(session.userId),
    listResumeVersions(session.userId),
    listContacts(session.userId, { pageSize: 100 }),
  ]);

  const options: JobFormOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    resumeVersions: resumes.map((r) => ({ id: r.id, label: r.label })),
    referralContacts: contacts.items.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add an application"
        description="Record a role you are applying to, or saving for later."
      />
      {/* Rendered open; the surrounding page is the dialog's full-screen context. */}
      <JobFormDialog open onOpenChange={() => redirect("/jobs")} options={options} />
    </div>
  );
}
