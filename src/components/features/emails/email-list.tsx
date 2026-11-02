"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ComposeDialog } from "@/components/features/emails/compose-dialog";
import { DeleteButton } from "@/components/features/common/delete-button";
import { deleteEmailAction } from "@/app/actions/outreach";
import { EMAIL_STATUS_BADGES, EMAIL_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils/date";
import type { JobOption, TemplateOption } from "./compose-dialog";

export interface EmailListItem {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  status: string;
  subject: string;
  body: string;
  toEmail: string | null;
  fromEmail: string | null;
  sentAt: Date | null;
  errorMessage: string | null;
  contactId: string | null;
  contact: { id: string; name: string; email: string | null } | null;
  jobId: string | null;
  job: { title: string; company: { name: string } } | null;
  inReplyToId: string | null;
}

export function EmailList({
  emails,
  templates,
  jobs,
  senderName,
  mailerConfigured,
}: {
  emails: EmailListItem[];
  templates: TemplateOption[];
  jobs: JobOption[];
  senderName: string;
  mailerConfigured: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [replying, setReplying] = React.useState<EmailListItem | null>(null);

  return (
    <>
      <ul className="divide-y divide-border">
        {emails.map((email) => {
          const inbound = email.direction === "INBOUND";
          const open = expanded === email.id;

          return (
            <li key={email.id} className="group">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : email.id)}
                aria-expanded={open}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover/60"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                    inbound
                      ? "bg-accent-subtle text-accent ring-accent/25"
                      : "bg-surface-sunken text-subtle ring-border",
                  )}
                  aria-hidden
                >
                  {inbound ? (
                    <ArrowDownLeft className="size-3.5" />
                  ) : (
                    <ArrowUpRight className="size-3.5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-foreground">
                      {email.subject || "(no subject)"}
                    </span>
                    <StatusBadge
                      label={
                        EMAIL_STATUS_LABELS[
                          email.status as keyof typeof EMAIL_STATUS_LABELS
                        ] ?? email.status
                      }
                      className={EMAIL_STATUS_BADGES[email.status as never]}
                    />
                    {inbound ? <span className="sr-only">Received</span> : null}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {email.contact ? (
                      <Link
                        href={`/contacts/${email.contact.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-accent hover:underline"
                      >
                        {email.contact.name}
                      </Link>
                    ) : (
                      <span className="truncate">
                        {inbound ? email.fromEmail : email.toEmail}
                      </span>
                    )}
                    {email.job ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {email.job.title} · {email.job.company.name}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {!open ? (
                    <p className="mt-1 line-clamp-1 text-xs text-subtle">
                      {email.body}
                    </p>
                  ) : null}
                </div>

                <span className="shrink-0 pt-0.5 text-xs text-subtle">
                  {email.sentAt ? formatDateTime(email.sentAt) : "—"}
                </span>
              </button>

              {open ? (
                <div className="space-y-3 border-t border-border bg-surface-sunken px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {email.body}
                  </p>

                  {email.errorMessage ? (
                    <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
                      Not delivered: {email.errorMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {email.contactId ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setReplying(email)}
                      >
                        <MessageSquareReply />
                        Reply
                      </Button>
                    ) : null}
                    {email.contact ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contacts/${email.contact.id}`}>
                          View contact
                        </Link>
                      </Button>
                    ) : null}
                    <DeleteButton
                      entityName="message"
                      onDelete={() => deleteEmailAction(email.id)}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {replying ? (
        <ComposeDialog
          open
          onOpenChange={(open) => {
            if (!open) setReplying(null);
            router.refresh();
          }}
          contactId={replying.contactId ?? undefined}
          toEmail={replying.contact?.email ?? null}
          toName={replying.contact?.name ?? null}
          templates={templates}
          jobs={jobs}
          senderName={senderName}
          mailerConfigured={mailerConfigured}
        />
      ) : null}
    </>
  );
}
