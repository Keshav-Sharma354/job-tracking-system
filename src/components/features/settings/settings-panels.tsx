"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  KeyRound,
  Monitor,
  Plus,
  Save,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
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
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/layout";
import { changePasswordAction, updateProfileAction, type AuthFormState } from "@/app/actions/auth";
import { setDefaultResumeAction, createResumeVersionAction, deleteResumeVersionAction } from "@/app/actions/settings";
import { ImportExportPanel } from "@/components/features/settings/import-export-panel";
import { useTheme } from "@/components/layout/theme-provider";

export interface SettingsPanelsProps {
  profile: { name: string; email: string; timezone: string };
  mailer: {
    configured: boolean;
    missing: string[];
    host: string | null;
    port: number | null;
    from: string | null;
    verified: boolean;
    verifyMessage: string | null;
  };
  inboundConfigured: boolean;
  sessions: Array<{
    id: string;
    createdLabel: string;
    lastUsedLabel: string;
    expiresLabel: string;
    userAgent: string | null;
    ipAddress: string | null;
  }>;
  resumes: Array<{
    id: string;
    label: string;
    summary: string | null;
    isDefault: boolean;
    jobs: number;
  }>;
  environment: "production" | "development";
}

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
];

export function SettingsPanels(props: SettingsPanelsProps) {
  const [addingResume, setAddingResume] = React.useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Profile */}
      <Card>
        <CardHeader title="Profile" description="How you appear in the app" />
        <CardBody>
          <ProfileForm profile={props.profile} />
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" description="Theme preference" />
        <CardBody>
          <ThemeSetting />
        </CardBody>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader
          title="Outbound email"
          description="Real SMTP delivery — never simulated"
        />
        <CardBody className="space-y-3">
          {props.mailer.configured ? (
            <>
              <p className="flex items-start gap-2 text-sm text-foreground">
                {props.mailer.verified ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <span>{props.mailer.verifyMessage}</span>
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">Relay</dt>
                  <dd className="text-foreground">
                    {props.mailer.host}:{props.mailer.port}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Sending as</dt>
                  <dd className="truncate text-foreground">{props.mailer.from}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="space-y-2">
              <p className="flex items-start gap-2 text-sm text-warning">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Sending is disabled. These environment variables are missing:{" "}
                  <span className="font-mono">{props.mailer.missing.join(", ")}</span>
                </span>
              </p>
              <p className="text-xs text-muted">
                Drafts still work. Nothing is recorded as sent until a real relay
                accepts the message.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-xs font-medium text-foreground">
              Inbound replies
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {props.inboundConfigured ? (
                <>
                  A webhook secret is configured. Point your mail provider at{" "}
                  <code className="font-mono">POST /api/webhooks/email-inbound</code>.
                </>
              ) : (
                <>
                  No webhook secret is set, so automatic reply detection is off.
                  You can still log replies by hand from a contact&apos;s page.
                </>
              )}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader
          title="Password"
          description="Changing it signs out every other device"
        />
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>

      {/* Resumes */}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Resume versions"
          description="Track which resume each application used"
          action={
            <Button size="sm" variant="secondary" onClick={() => setAddingResume(true)}>
              <Plus />
              Add version
            </Button>
          }
        />
        <CardBody className="p-0">
          {props.resumes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No resume versions tracked yet. Add one to record which CV you sent.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {props.resumes.map((resume) => (
                <ResumeRow key={resume.id} resume={resume} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Sessions */}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Active sessions"
          description="Devices currently signed in to this account"
          action={<Monitor className="size-4 text-subtle" aria-hidden />}
        />
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {props.sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {s.userAgent ?? "Unknown device"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    last used {new Date(s.lastUsedLabel).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-subtle">
                  expires {new Date(s.expiresLabel).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Environment */}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Environment"
          description="Build and export diagnostics"
          action={<Server className="size-4 text-subtle" aria-hidden />}
        />
        <CardBody className="flex flex-wrap gap-2">
          <StatusBadge
            label={`NODE_ENV=${props.environment}`}
            tone={props.environment === "production" ? "success" : "warning"}
          />
          <StatusBadge
            label={`Sessions: ${props.sessions.length}`}
            tone="neutral"
          />
          <StatusBadge
            label={`Resumes: ${props.resumes.length}`}
            tone="neutral"
          />
          <StatusBadge
            label={`Mailer: ${props.mailer.configured ? "configured" : "not configured"}`}
            tone={props.mailer.configured ? "success" : "warning"}
          />
        </CardBody>
      </Card>

      <ResumeDialog open={addingResume} onOpenChange={setAddingResume} />

      <ImportExportPanel />
    </div>
  );
}

function ProfileForm({ profile }: { profile: SettingsPanelsProps["profile"] }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<
    AuthFormState,
    FormData
  >(updateProfileAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="settings-name" required>
          Name
        </Label>
        <Input
          id="settings-name"
          name="name"
          defaultValue={profile.name}
          required
          invalid={Boolean(state.errors?.name)}
        />
        {state.errors?.name ? (
          <p className="text-xs text-destructive">{state.errors.name}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-email">Email</Label>
        <Input
          id="settings-email"
          value={profile.email}
          readOnly
          disabled
          className="opacity-70"
        />
        <p className="text-xs text-subtle">
          Your sign-in address cannot be changed from here.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-timezone" required>
          Timezone
        </Label>
        <Select
          id="settings-timezone"
          name="timezone"
          defaultValue={profile.timezone}
          invalid={Boolean(state.errors?.timezone)}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
        <p className="text-xs text-subtle">
          Used to decide when a follow-up is &ldquo;due today&rdquo;.
        </p>
        {state.errors?.timezone ? (
          <p className="text-xs text-destructive">{state.errors.timezone}</p>
        ) : null}
      </div>

      {state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
      {state.formError ? (
        <p className="text-sm text-destructive">{state.formError}</p>
      ) : null}

      <Button type="submit" loading={pending}>
        <Save />
        Save profile
      </Button>
      <span className="sr-only">{router ? "" : ""}</span>
    </form>
  );
}

function PasswordForm() {
  const [state, formAction, pending] = React.useActionState<
    AuthFormState,
    FormData
  >(changePasswordAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="settings-current" required>
          Current password
        </Label>
        <Input
          id="settings-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.errors?.currentPassword ? (
          <p className="text-xs text-destructive">
            {state.errors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-new" required>
          New password
        </Label>
        <Input
          id="settings-new"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-subtle">
          At least 12 characters with uppercase, lowercase and a number.
        </p>
        {state.errors?.password ? (
          <p className="text-xs text-destructive">{state.errors.password}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-confirm" required>
          Confirm new password
        </Label>
        <Input
          id="settings-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        {state.errors?.confirmPassword ? (
          <p className="text-xs text-destructive">
            {state.errors.confirmPassword}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
      {state.formError ? (
        <p className="text-sm text-destructive">{state.formError}</p>
      ) : null}

      <Button type="submit" variant="secondary" loading={pending}>
        <KeyRound />
        Update password
      </Button>
    </form>
  );
}

function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Your choice is stored in this browser and applied before the page renders.
      </p>
      <div className="flex gap-2">
        <Button
          variant={theme === "light" ? "primary" : "secondary"}
          onClick={() => setTheme("light")}
          aria-pressed={theme === "light"}
        >
          Light
        </Button>
        <Button
          variant={theme === "dark" ? "primary" : "secondary"}
          onClick={() => setTheme("dark")}
          aria-pressed={theme === "dark"}
        >
          Dark
        </Button>
      </div>
    </div>
  );
}

function ResumeRow({
  resume,
}: {
  resume: SettingsPanelsProps["resumes"][number];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function setDefault() {
    setPending(true);
    try {
      await setDefaultResumeAction(resume.id);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-4 shrink-0 text-subtle" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm text-foreground">
          {resume.label}
          {resume.isDefault ? <StatusBadge label="Default" tone="accent" /> : null}
        </p>
        <p className="truncate text-xs text-muted">
          {resume.summary ?? "No description"} · used by {resume.jobs} application
          {resume.jobs === 1 ? "" : "s"}
        </p>
      </div>
      {!resume.isDefault ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={setDefault}
          loading={pending}
        >
          Make default
        </Button>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Delete ${resume.label}`}
        onClick={async () => {
          await deleteResumeVersionAction(resume.id);
          router.refresh();
        }}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function ResumeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add resume version</DialogTitle>
          <DialogDescription>
            Give this version a name so you can tell which CV you sent.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData: FormData) => {
            await createResumeVersionAction(Object.fromEntries(formData));
            onOpenChange(false);
            router.refresh();
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resume-label" required>
                Label
              </Label>
              <Input
                id="resume-label"
                name="label"
                placeholder="e.g. Backend / Platform 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resume-summary">Description</Label>
              <Textarea
                id="resume-summary"
                name="summary"
                rows={3}
                placeholder="What does this version emphasise?"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitResumeButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitResumeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Add version
    </Button>
  );
}
