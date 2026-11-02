"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ExternalLink, Link2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow, EmptyState } from "@/components/ui/layout";
import { Avatar, LabelBadge, StatusBadge } from "@/components/ui/badge";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { companyFormFields } from "@/components/features/companies/company-form-fields";
import { DeleteButton } from "@/components/features/common/delete-button";
import { updateCompanyAction, deleteCompanyAction } from "@/app/actions/crm";

export interface CompanyDetailViewProps {
  company: {
    id: string;
    name: string;
    websiteUrl: string | null;
    linkedinUrl: string | null;
    industry: string | null;
    location: string | null;
    size: string | null;
    notes: string | null;
    tags: string[];
    _count: { jobs: number; contacts: number };
  };
  jobs: Array<{
    id: string;
    title: string;
    location: string | null;
    statusLabel: string;
    statusBadgeClass: string;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    contactTypeLabel: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    noteType: string;
    createdAt: Date;
  }>;
}

export function CompanyDetailView(props: CompanyDetailViewProps) {
  const { company } = props;
  const [editing, setEditing] = React.useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar label={company.name} className="size-11 text-sm" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {company.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {[company.industry, company.location, company.size]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {company.websiteUrl ? (
            <Button variant="secondary" asChild>
              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Website
              </a>
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <DeleteButton
            entityName={company.name}
            description="Deleting a company also deletes its applications and unlinks its contacts. This cannot be undone."
            onDelete={() => deleteCompanyAction(company.id)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Applications" description={`${props.jobs.length} tracked`} />
            <CardBody className="p-0">
              {props.jobs.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="size-5" />}
                  title="No applications here yet"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {props.jobs.map((job) => (
                    <li key={job.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="block truncate text-sm font-medium text-foreground hover:text-accent"
                        >
                          {job.title}
                        </Link>
                        {job.location ? (
                          <p className="truncate text-xs text-muted">{job.location}</p>
                        ) : null}
                      </div>
                      <StatusBadge
                        label={job.statusLabel}
                        className={job.statusBadgeClass}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" description="Research captured across this company's applications" />
            <CardBody className="space-y-2.5">
              {props.notes.length === 0 ? (
                <EmptyState title="No notes yet" />
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
                        {new Date(note.createdAt).toLocaleDateString()}
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
                <DetailRow label="Industry">{company.industry ?? "—"}</DetailRow>
                <DetailRow label="Size">{company.size ?? "—"}</DetailRow>
                <DetailRow label="Location">{company.location ?? "—"}</DetailRow>
                <DetailRow label="Applications">{company._count.jobs}</DetailRow>
              </dl>

              <div className="mt-4 flex flex-col gap-2">
                {company.linkedinUrl ? (
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    <Link2 className="size-3.5" />
                    LinkedIn profile
                  </a>
                ) : null}
                {company.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {company.tags.map((tag) => (
                      <LabelBadge key={tag} seed={tag}>
                        {tag}
                      </LabelBadge>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="People" description={`${props.contacts.length} contacts here`} />
            <CardBody className="p-0">
              {props.contacts.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No contacts yet"
                  description="Add the recruiter or hiring manager so future outreach has context."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {props.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar label={contact.name} className="size-7 text-[0.625rem]" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="block truncate text-sm text-foreground hover:text-accent"
                        >
                          {contact.name}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {contact.contactTypeLabel}
                        </p>
                      </div>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          aria-label={`Email ${contact.name}`}
                          className="shrink-0 rounded p-1 text-subtle hover:bg-surface-hover hover:text-accent"
                        >
                          <Link2 className="size-3.5" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {company.notes ? (
            <Card>
              <CardHeader title="Research notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {company.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <ResourceFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit company"
        submitLabel="Save changes"
        fields={companyFormFields(company)}
        action={async (formData) =>
          updateCompanyAction(company.id, Object.fromEntries(formData))
        }
      />
    </div>
  );
}
