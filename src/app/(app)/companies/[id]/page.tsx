import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getCompanyById } from "@/server/repo/companies";
import { listContacts } from "@/server/repo/contacts";
import { listAllJobs } from "@/server/repo/jobs";
import { db } from "@/lib/db";
import { CONTACT_TYPE_LABELS, STATUS_META } from "@/lib/constants";
import { CompanyDetailView } from "@/components/features/companies/company-detail-view";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const company = await getCompanyById(session.userId, id);
  if (!company) notFound();

  const [jobs, contacts, notes] = await Promise.all([
    listAllJobs(session.userId, { companyId: id }),
    listContacts(session.userId, { companyId: id, pageSize: 100 }),
    db.note.findMany({
      where: { userId: session.userId, job: { companyId: id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, body: true, noteType: true, createdAt: true },
    }),
  ]);

  return (
    <CompanyDetailView
      company={company}
      jobs={jobs.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        statusLabel: STATUS_META[job.status].label,
        statusBadgeClass: STATUS_META[job.status].badge,
        location: job.location,
      }))}
      contacts={contacts.items.map((contact) => ({
        id: contact.id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        contactTypeLabel: CONTACT_TYPE_LABELS[contact.contactType],
      }))}
      notes={notes}
    />
  );
}
