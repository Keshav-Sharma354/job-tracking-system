"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Send, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";
import { createDraftAction, sendEmailAction } from "@/app/actions/outreach";
import { extractVariables, renderTemplate } from "@/server/email/templates";

export interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

export interface JobOption {
  id: string;
  label: string;
}

/**
 * Email composer.
 *
 * "Save draft" and "Send now" are separate, explicit actions. Sending requires
 * a confirmation step and surfaces the server's real outcome — if SMTP is not
 * configured the dialog says so and the message stays a draft, rather than
 * reporting a success that did not happen.
 */
export function ComposeDialog({
  open,
  onOpenChange,
  contactId,
  toEmail,
  toName,
  jobId,
  templates,
  jobs,
  senderName,
  mailerConfigured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  toEmail?: string | null;
  toName?: string | null;
  jobId?: string;
  templates: TemplateOption[];
  jobs: JobOption[];
  senderName?: string;
  /** Drives whether the send button is offered at all. */
  mailerConfigured: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState("COLD_OUTREACH");
  const [templateId, setTemplateId] = React.useState("");
  const [pending, setPending] = React.useState<"save" | "send" | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  // Reset the composer each time it opens so a previous draft does not linger.
  // `key` remounting is avoided; instead the values are only seeded when the
  // dialog opens, which `key={String(open)}` on the body achieves implicitly
  // because Radix unmounts the content when closed.
  const [lastOpen, setLastOpen] = React.useState(open);

  if (open !== lastOpen) {
    // Adjusting state during render is the supported pattern for reacting to a
    // prop change, and avoids a cascading render from an effect.
    if (open) {
      setSubject("");
      setBody("");
      setCategory("COLD_OUTREACH");
      setTemplateId("");
      setError(null);
      setConfirming(false);
      setCreatedId(null);
    }
    setLastOpen(open);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
    setCategory(template.category);
  }

  // Variables the current draft references, so the user knows what a template
  // expects before sending.
  const unresolved = React.useMemo(() => {
    const known = new Set(
      [
        "firstName",
        "lastName",
        "contactName",
        "contactTitle",
        "contactCompany",
        "company",
        "jobTitle",
        "role",
        "senderName",
        "myName",
      ],
    );
    return [...new Set([...extractVariables(subject), ...extractVariables(body)])]
      .filter((name) => !known.has(name))
      .map((name) => `{{${name}}}`);
  }, [subject, body]);

  async function saveDraft(): Promise<string | null> {
    setPending("save");
    setError(null);
    try {
      const result = await createDraftAction({
        contactId: contactId ?? "",
        jobId: jobId ?? "",
        templateId: templateId ?? "",
        category,
        toEmail: toEmail ?? "",
        toName: toName ?? "",
        subject,
        body,
        scheduledAt: "",
      });

      if (result.ok) {
        setCreatedId(result.data.id);
        toast.success("Draft saved");
        router.refresh();
        return result.data.id;
      }

      setError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(`${field}: ${message}`);
        }
      }
      return null;
    } finally {
      setPending(null);
    }
  }

  async function sendNow() {
    setPending("send");
    setError(null);
    try {
      // Saving first means a failed send still leaves the text recoverable.
      const id = createdId ?? (await saveDraftInternal());
      if (!id) return;

      const result = await sendEmailAction({ emailId: id, confirm: true });
      if (result.ok) {
        toast.success(result.message ?? "Message sent");
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
        setConfirming(false);
      }
    } finally {
      setPending(null);
    }
  }

  /** Save without touching the "save" pending flag, which `send` already owns. */
  async function saveDraftInternal(): Promise<string | null> {
    const result = await createDraftAction({
      contactId: contactId ?? "",
      jobId: jobId ?? "",
      templateId: templateId ?? "",
      category,
      toEmail: toEmail ?? "",
      toName: toName ?? "",
      subject,
      body,
      scheduledAt: "",
    });

    if (!result.ok) {
      setError(result.error);
      return null;
    }

    setCreatedId(result.data.id);
    router.refresh();
    return result.data.id;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compose email</DialogTitle>
          <DialogDescription>
            {toEmail ? (
              <>
                To <span className="font-medium text-foreground">{toName ? `${toName} <${toEmail}>` : toEmail}</span>
              </>
            ) : (
              "No recipient selected"
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="compose-subject" required>
                Subject
              </Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Staff Engineer at Acme — quick question"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-category">Type</Label>
              <Select
                id="compose-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="COLD_OUTREACH">Cold outreach</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="REFERRAL_REQUEST">Referral request</option>
                <option value="THANK_YOU">Thank you</option>
                <option value="INTERVIEW_CONFIRMATION">Interview confirmation</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="compose-template">Start from a template</Label>
              <Select
                id="compose-template"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                <option value="">Blank</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-job">Related application</Label>
              <Select
                id="compose-job"
                defaultValue={jobId ?? ""}
                onChange={() => {
                  /* The job link is set at draft creation from the parent view. */
                }}
              >
                <option value="">Not linked</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="compose-body" required>
                Message
              </Label>
              {senderName ? (
                <span className="text-xs text-subtle">
                  <Sparkles className="mr-1 inline size-3" />
                  Personalise with {"{{firstName}}"}, {"{{company}}"}, {"{{jobTitle}}"}
                </span>
              ) : null}
            </div>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={14}
              placeholder="Write your message…"
              className="font-mono text-[0.8125rem] leading-relaxed"
            />
          </div>

          {unresolved.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                These placeholders are not automatically filled in and will be sent
                as-is: {unresolved.join(", ")}
              </span>
            </p>
          ) : null}

          {!mailerConfigured ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Email sending is not configured on this server, so &ldquo;Send&rdquo;
                is unavailable. You can still save the draft and copy it into your
                own mail client. Set the <code className="font-mono">SMTP_*</code>{" "}
                environment variables to enable sending.
              </span>
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          {confirming ? (
            <div className="space-y-3 rounded-lg border border-accent/30 bg-accent-subtle/50 p-3">
              <p className="text-sm font-medium text-foreground">
                Send this email to {toEmail}?
              </p>
              <p className="text-xs text-muted">
                It will be delivered through the configured SMTP relay. This cannot
                be undone, and the message is recorded in your outreach history.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={sendNow} loading={pending === "send"}>
                  <Send />
                  Yes, send it
                </Button>
              </div>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={saveDraft}
            loading={pending === "save"}
            disabled={!subject.trim() || !body.trim()}
          >
            <Save />
            Save draft
          </Button>
          <Button
            onClick={() => setConfirming(true)}
            disabled={!mailerConfigured || !subject.trim() || !body.trim()}
            title={
              mailerConfigured
                ? undefined
                : "Email sending is not configured on this server"
            }
            className={cn(!mailerConfigured && "opacity-60")}
          >
            <Send />
            Send now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Renders template variables for a preview. Exported for reuse in tests. */
export function previewTemplate(text: string, vars: Record<string, string>) {
  return renderTemplate(text, vars);
}

/**
 * Toolbar-style entry point: pick a contact, then compose.
 *
 * Used on the outreach list where there is no surrounding contact to inherit a
 * recipient from.
 */
export function NewEmailButton({
  contacts,
  templates,
  jobs,
  senderName,
  mailerConfigured,
}: {
  contacts: { id: string; name: string; email: string }[];
  templates: TemplateOption[];
  jobs: JobOption[];
  senderName: string;
  mailerConfigured: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [contactId, setContactId] = React.useState("");

  const selected = contacts.find((c) => c.id === contactId);

  if (contacts.length === 0) {
    return (
      <Button asChild>
        <Link href="/contacts">
          <Send aria-hidden />
          Add a contact first
        </Link>
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
          aria-label="Choose a contact"
          className="h-9 w-auto min-w-44"
        >
          <option value="">Choose a contact…</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </Select>
        <Button onClick={() => setOpen(true)} disabled={!selected}>
          <Send />
          Compose
        </Button>
      </div>

      {selected ? (
        <ComposeDialog
          open={open}
          onOpenChange={setOpen}
          contactId={selected.id}
          toEmail={selected.email}
          toName={selected.name}
          templates={templates}
          jobs={jobs}
          senderName={senderName}
          mailerConfigured={mailerConfigured}
        />
      ) : null}
    </>
  );
}
