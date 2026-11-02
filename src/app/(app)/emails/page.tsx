import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listEmails, listTemplates, countByEmailStatus } from "@/server/repo/emails";
import { listContacts } from "@/server/repo/contacts";
import { listAllJobs } from "@/server/repo/jobs";
import { isMailerConfigured } from "@/server/email/mailer";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { MailerBanner } from "@/components/features/emails/mailer-banner";
import { OutreachToolbar } from "@/components/features/emails/outreach-toolbar";
import { EmailList } from "@/components/features/emails/email-list";
import { NewEmailButton } from "@/components/features/emails/compose-dialog";

export const metadata: Metadata = { title: "Outreach" };

const PER_PAGE = 40;

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";

  const [result, templates, counts, contacts, jobs] = await Promise.all([
    listEmails(session.userId, {
      q: first(params.q) || undefined,
      status: (first(params.status) as never) || undefined,
      direction: (first(params.direction) as never) || undefined,
      page: Number(first(params.page)) || 1,
      pageSize: PER_PAGE,
    }),
    listTemplates(session.userId),
    countByEmailStatus(session.userId),
    listContacts(session.userId, { pageSize: 200 }),
    listAllJobs(session.userId),
  ]);

  const mailerConfigured = isMailerConfigured();

  const composeOptions = {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      category: t.category,
    })),
    jobs: jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.company.name}` })),
    senderName: session.user.name,
    mailerConfigured,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Outreach"
        description={`${result.total} message${result.total === 1 ? "" : "s"} tracked`}
        actions={
          <NewEmailButton
            {...composeOptions}
            contacts={contacts.items
              .filter((c) => c.email)
              .map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email as string,
              }))}
          />
        }
      />

      {!mailerConfigured ? <MailerBanner /> : null}

      <OutreachToolbar counts={counts} />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-5" />}
            title="No outreach yet"
            description="Compose a personalised message from a contact's page, or start here. Replies are threaded back automatically."
          />
        ) : (
          <EmailList emails={result.items} {...composeOptions} />
        )}
      </Card>
    </div>
  );
}
