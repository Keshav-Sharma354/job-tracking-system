"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Link2,
  Mail,
  Pencil,
  Phone,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow, EmptyState } from "@/components/ui/layout";
import { Avatar, LabelBadge, StatusBadge } from "@/components/ui/badge";
import { ContactFormDialog } from "@/components/features/contacts/contact-form-dialog";
import { DeleteButton } from "@/components/features/common/delete-button";
import { NoteComposer } from "@/components/features/notes/note-composer";
import { TaskQuickAdd } from "@/components/features/tasks/task-quick-add";
import { ComposeDialog, type JobOption, type TemplateOption } from "@/components/features/emails/compose-dialog";
import { deleteContactAction } from "@/app/actions/crm";
import { EMAIL_STATUS_BADGES, EMAIL_STATUS_LABELS } from "@/lib/constants";
import { formatRelativeDue } from "@/lib/utils/date";

export interface ContactDetailViewProps {
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    title: string | null;
    notes: string | null;
    tags: string[];
    contactType: string;
    contactTypeLabel: string;
    relationship: string;
    lastContactedAt: Date | null;
    lastContactedLabel: string;
    company: { id: string; name: string } | null;
    companyId: string | null;
    _count: { emails: number; tasks: number; noteRecords: number };
  };
  thread: Array<{
    id: string;
    direction: "OUTBOUND" | "INBOUND";
    status: string;
    subject: string;
    body: string;
    toEmail: string | null;
    fromEmail: string | null;
    sentLabel: string | null;
    errorMessage: string | null;
  }>;
  notes: Array<{
    id: string;
    body: string;
    noteType: string;
    createdAt: Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    status: string;
  }>;
  linkedJobs: Array<{
    id: string;
    title: string;
    status: string;
    company: { name: string };
  }>;
  deliveries: Array<{
    id: string;
    status: string;
    provider: string;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  companyOptions: { id: string; name: string }[];
  templates: TemplateOption[];
  jobs: JobOption[];
  senderName: string;
  mailerConfigured: boolean;
  timezone: string;
}

export function ContactDetailView(props: ContactDetailViewProps) {
  const { contact } = props;
  const [editing, setEditing] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar label={contact.name} className="size-11 text-sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {contact.name}
              </h1>
              <StatusBadge label={contact.contactTypeLabel} tone="accent" />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {contact.title ?? "—"}
              {contact.company ? (
                <>
                  {" · "}
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="inline-flex items-center gap-1 hover:text-accent hover:underline"
                  >
                    <Building2 className="size-3.5" aria-hidden />
                    {contact.company.name}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setComposing(true)}
            disabled={!contact.email}
            title={contact.email ? undefined : "Add an email address first"}
          >
            <Mail />
            Compose
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <DeleteButton
            entityName={contact.name}
            onDelete={() => deleteContactAction(contact.id)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Conversation */}
          <Card>
            <CardHeader
              title="Conversation"
              description={`${props.thread.length} message${props.thread.length === 1 ? "" : "s"}`}
              action={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setComposing(true)}
                  disabled={!contact.email}
                >
                  <Plus />
                  <span className="sr-only">Compose</span>
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {props.thread.length === 0 ? (
                <EmptyState
                  icon={<Mail className="size-5" />}
                  title="No messages yet"
                  description={
                    contact.email
                      ? "Send the first email and it will be threaded here automatically."
                      : "Add an email address to this contact to start a conversation."
                  }
                  action={
                    contact.email ? (
                      <Button size="sm" onClick={() => setComposing(true)}>
                        Compose email
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {props.thread.map((message) => (
                    <li
                      key={message.id}
                      className={
                        message.direction === "OUTBOUND"
                          ? "ml-6 rounded-lg rounded-tr-sm border border-border bg-surface-sunken p-3"
                          : "mr-6 rounded-lg rounded-tl-sm border border-accent/25 bg-accent-subtle/50 p-3"
                      }
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {message.direction === "OUTBOUND"
                            ? `To ${contact.name}`
                            : `From ${contact.name}`}
                        </span>
                        <StatusBadge
                          label={EMAIL_STATUS_LABELS[
                            message.status as keyof typeof EMAIL_STATUS_LABELS
                          ] ?? message.status}
                          className={EMAIL_STATUS_BADGES[message.status as never]}
                        />
                        {message.sentLabel ? (
                          <span className="text-xs text-subtle">
                            {message.sentLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {message.subject || "(no subject)"}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {message.body}
                      </p>
                      {message.errorMessage ? (
                        <p className="mt-2 rounded bg-destructive-subtle px-2 py-1 text-xs text-destructive">
                          {message.errorMessage}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader title="Notes" />
            <CardBody className="space-y-3">
              <NoteComposer contactId={contact.id} />
              {props.notes.length === 0 ? (
                <EmptyState
                  icon={<StickyNote className="size-5" />}
                  title="No notes yet"
                  description="How you know them, what they care about, who to ask for."
                />
              ) : (
                <ul className="space-y-2.5">
                  {props.notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-border bg-surface-sunken p-3"
                    >
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {note.body}
                      </p>
                      <p className="mt-1.5 text-xs text-subtle">
                        {note.noteType.toLowerCase().replace(/_/g, " ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailRow label="Email">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1 break-all hover:text-accent hover:underline"
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {contact.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Phone">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 hover:text-accent hover:underline"
                    >
                      <Phone className="size-3.5 shrink-0" aria-hidden />
                      {contact.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="LinkedIn">
                  {contact.linkedinUrl ? (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-accent hover:underline"
                    >
                      <Link2 className="size-3.5 shrink-0" aria-hidden />
                      Profile
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Last contacted">{contact.lastContactedLabel}</DetailRow>
              </dl>

              {contact.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <LabelBadge key={tag} seed={tag}>
                      {tag}
                    </LabelBadge>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {props.linkedJobs.length > 0 ? (
            <Card>
              <CardHeader title="Referred" description="Applications they referred" />
              <CardBody className="p-0">
                <ul className="divide-y divide-border">
                  {props.linkedJobs.map((job) => (
                    <li key={job.id} className="px-4 py-2.5">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="block truncate text-sm text-foreground hover:text-accent"
                      >
                        {job.title}
                      </Link>
                      <p className="truncate text-xs text-muted">{job.company.name}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Follow-ups"
              description={`${props.tasks.filter((t) => t.status === "OPEN").length} open`}
            />
            <CardBody className="space-y-3">
              <TaskQuickAdd contactId={contact.id} />
              {props.tasks.length === 0 ? (
                <EmptyState title="Nothing scheduled" />
              ) : (
                <ul className="space-y-2">
                  {props.tasks.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-2">
                      <span
                        className={
                          task.status === "DONE"
                            ? "text-sm text-subtle line-through"
                            : "text-sm text-foreground"
                        }
                      >
                        {task.title}
                      </span>
                      <span className="shrink-0 text-xs text-subtle">
                        {task.dueAt
                          ? formatRelativeDue(task.dueAt, new Date(), props.timezone)
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {props.deliveries.length > 0 ? (
            <Card>
              <CardHeader
                title="Delivery log"
                description="Real SMTP delivery attempts"
              />
              <CardBody className="p-0">
                <ul className="divide-y divide-border">
                  {props.deliveries.slice(0, 8).map((delivery) => (
                    <li
                      key={delivery.id}
                      className="flex items-center justify-between gap-2 px-4 py-2 text-xs"
                    >
                      <span className="text-muted">
                        {delivery.provider} ·{" "}
                        {new Date(delivery.createdAt).toLocaleDateString()}
                      </span>
                      <StatusBadge
                        label={delivery.status.toLowerCase()}
                        tone={
                          delivery.status === "SENT"
                            ? "success"
                            : "danger"
                        }
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {contact.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {contact.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <ContactFormDialog
        open={editing}
        onOpenChange={setEditing}
        contactId={contact.id}
        options={{ companies: props.companyOptions }}
        defaults={{
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
          title: contact.title,
          companyId: contact.companyId,
          contactType: contact.contactType,
          relationship: contact.relationship,
          lastContactedAt: contact.lastContactedAt,
          notes: contact.notes,
          tags: contact.tags,
        }}
      />

      <ComposeDialog
        open={composing}
        onOpenChange={setComposing}
        contactId={contact.id}
        toEmail={contact.email}
        toName={contact.name}
        templates={props.templates}
        jobs={props.jobs}
        senderName={props.senderName}
        mailerConfigured={props.mailerConfigured}
      />
    </div>
  );
}
