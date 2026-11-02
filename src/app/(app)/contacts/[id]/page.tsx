import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getContactById } from "@/server/repo/contacts";
import { listAllCompanies } from "@/server/repo/companies";
import { listThread, listDeliveries, listTemplates } from "@/server/repo/emails";
import { listNotesForContact } from "@/server/repo/notes";
import { listTasks } from "@/server/repo/tasks";
import { listAllJobs } from "@/server/repo/jobs";
import { db } from "@/lib/db";
import { CONTACT_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, formatRelativeDue } from "@/lib/utils/date";
import { isMailerConfigured } from "@/server/email/mailer";
import { ContactDetailView } from "@/components/features/contacts/contact-detail-view";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const contact = await getContactById(session.userId, id);
  if (!contact) notFound();

  const [companies, thread, contactNotes, tasks, linkedJobs, templates, jobs] =
    await Promise.all([
      listAllCompanies(session.userId),
      listThread(session.userId, id),
      listNotesForContact(session.userId, id),
      listTasks(session.userId, { contactId: id, pageSize: 50 }),
      db.job.findMany({
        where: { userId: session.userId, referralContactId: id },
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true } },
        },
      }),
      listTemplates(session.userId),
      listAllJobs(session.userId),
    ]);

  // Delivery attempts across the whole thread, newest first.
  const deliveries = (
    await Promise.all(
      thread.slice(-6).map((message) => listDeliveries(session.userId, message.id)),
    )
  ).flat();

  return (
    <ContactDetailView
      contact={{
        ...contact,
        contactTypeLabel: CONTACT_TYPE_LABELS[contact.contactType],
        lastContactedLabel: contact.lastContactedAt
          ? formatRelativeDue(
              contact.lastContactedAt,
              new Date(),
              session.user.timezone,
            )
          : "Never",
      }}
      thread={thread.map((message) => ({
        ...message,
        sentLabel: message.sentAt ? formatDateTime(message.sentAt) : null,
      }))}
      notes={contactNotes}
      tasks={tasks.items}
      linkedJobs={linkedJobs}
      deliveries={deliveries}
      companyOptions={companies.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        category: t.category,
      }))}
      jobs={jobs.map((job) => ({
        id: job.id,
        label: `${job.title} · ${job.company.name}`,
      }))}
      senderName={session.user.name}
      mailerConfigured={isMailerConfigured()}
      timezone={session.user.timezone}
    />
  );
}
