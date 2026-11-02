"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/layout";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { DeleteButton } from "@/components/features/common/delete-button";
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from "@/app/actions/outreach";
import { extractVariables } from "@/server/email/templates";
import { EMAIL_CATEGORY_LABELS } from "@/lib/constants";
import type { FieldSpec } from "@/components/ui/resource-form";

export interface TemplateListItem {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  categoryLabel: string;
  isFavorite: boolean;
  updatedLabel: string;
  _count: { emails: number };
}

function templateFields(
  defaults?: Partial<TemplateListItem>,
): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Template name",
      type: "text",
      required: true,
      span: 8,
      placeholder: "e.g. Follow-up after applying",
      defaultValue: defaults?.name ?? "",
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      span: 4,
      defaultValue: defaults?.category ?? "COLD_OUTREACH",
      options: Object.entries(EMAIL_CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "subject",
      label: "Subject",
      type: "text",
      required: true,
      span: 12,
      placeholder: "Following up — {{jobTitle}} at {{company}}",
      defaultValue: defaults?.subject ?? "",
    },
    {
      name: "body",
      label: "Body",
      type: "textarea",
      required: true,
      span: 12,
      placeholder: "Hi {{firstName}},\n\n…",
      hint: "Use {{firstName}}, {{company}}, {{jobTitle}} and {{senderName}}.",
      defaultValue: defaults?.body ?? "",
    },
    {
      name: "isFavorite",
      label: "Pin to the top of the list",
      type: "checkbox",
      span: 12,
      defaultValue: defaults?.isFavorite ?? false,
    },
  ];
}

export function TemplateList({ templates }: { templates: TemplateListItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateListItem | null>(null);

  if (templates.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<NotebookPen className="size-5" />}
            title="No templates yet"
            description="Templates let you write a strong message once and personalise it per recipient with variables like {{firstName}} and {{company}}."
            action={
              <Button onClick={() => setCreating(true)}>
                <NotebookPen />
                New template
              </Button>
            }
          />
        </Card>

        <ResourceFormDialog
          open={creating}
          onOpenChange={setCreating}
          title="New template"
          description="Create a reusable message"
          submitLabel="Create template"
          fields={templateFields()}
          action={createTemplateAction}
          onSuccess={() => router.refresh()}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <NotebookPen />
          New template
        </Button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const variables = extractVariables(template.subject, template.body);

          return (
            <li key={template.id}>
              <Card className="flex h-full flex-col">
                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                        {template.isFavorite ? (
                          <Star className="size-3.5 shrink-0 text-warning" aria-hidden />
                        ) : null}
                        {template.name}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {template.subject}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(template)}
                        aria-label={`Edit ${template.name}`}
                      >
                        <Pencil />
                      </Button>
                      <DeleteButton
                        entityName="template"
                        onDelete={() => deleteTemplateAction(template.id)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge label={template.categoryLabel} tone="accent" />
                    <span className="text-[0.6875rem] text-subtle">
                      Used {template._count.emails}×
                    </span>
                    <span className="text-[0.6875rem] text-subtle">
                      Updated {template.updatedLabel}
                    </span>
                  </div>

                  <pre className="max-h-40 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-sunken p-2.5 font-sans text-xs leading-relaxed text-muted">
                    {template.body}
                  </pre>

                  {variables.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {variables.map((variable) => (
                        <code
                          key={variable}
                          className="rounded bg-accent-subtle px-1.5 py-0.5 font-mono text-[0.625rem] text-accent"
                        >
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>

      <ResourceFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New template"
        description="Write it once, personalise it per recipient."
        submitLabel="Create template"
        fields={templateFields()}
        action={async (formData) =>
          createTemplateAction(Object.fromEntries(formData))
        }
      />

      {editing ? (
        <ResourceFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
            router.refresh();
          }}
          title="Edit template"
          submitLabel="Save changes"
          fields={templateFields(editing)}
          action={async (formData) =>
            updateTemplateAction(editing.id, Object.fromEntries(formData))
          }
        />
      ) : null}
    </>
  );
}
