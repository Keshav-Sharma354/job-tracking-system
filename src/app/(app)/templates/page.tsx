import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listTemplates } from "@/server/repo/emails";
import { EMAIL_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils/date";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { TemplateList } from "@/components/features/templates/template-list";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const session = await requireSession();
  const templates = await listTemplates(session.userId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Reusable messages with {{variables}} you fill in per contact"
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<NotebookPen className="size-5" />}
            title="No templates yet"
            description="Templates let you write a strong message once and personalise it per recipient with variables like {{firstName}} and {{company}}."
          />
        </Card>
      ) : (
        <TemplateList
          templates={templates.map((template) => ({
            ...template,
            categoryLabel:
              EMAIL_CATEGORY_LABELS[
                template.category as keyof typeof EMAIL_CATEGORY_LABELS
              ] ?? template.category,
            updatedLabel: formatDate(template.updatedAt),
          }))}
        />
      )}

      <p className="text-xs text-subtle">
        Variables such as{" "}
        <code className="font-mono">{"{{firstName}}"}</code>,{" "}
        <code className="font-mono">{"{{company}}"}</code> and{" "}
        <code className="font-mono">{"{{jobTitle}}"}</code> are filled in when
        you compose from a contact&apos;s page. Anything the app does not recognise
        is left visible so you can replace it before sending.{" "}
        <Link href="/contacts" className="text-accent hover:underline">
          Browse contacts
        </Link>
      </p>
    </div>
  );
}
