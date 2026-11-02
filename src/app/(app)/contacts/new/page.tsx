import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listAllCompanies } from "@/server/repo/companies";
import { PageHeader } from "@/components/ui/layout";
import { NewContactClient } from "./new-contact-client";
import type { ContactFormOptions } from "@/components/features/contacts/contact-form-fields";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage() {
  const session = await requireSession();
  const companies = await listAllCompanies(session.userId);

  const options: ContactFormOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add a contact"
        description="Recruiters, hiring managers, referrals — everyone you talk to."
      />
      <NewContactClient options={options} />
    </div>
  );
}

