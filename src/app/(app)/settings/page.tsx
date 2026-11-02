import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listResumeVersions } from "@/server/repo/activity";
import { verifyTransport, getMailerStatus } from "@/server/email/mailer";
import { listUserSessions } from "@/lib/auth/session-core";
import { isProduction } from "@/lib/env";
import { PageHeader } from "@/components/ui/layout";
import { SettingsPanels } from "@/components/features/settings/settings-panels";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const userId = session.userId;

  const [resumes, sessions, mailerStatus] = await Promise.all([
    listResumeVersions(userId),
    listUserSessions(userId),
    Promise.resolve(getMailerStatus()),
  ]);

  // Verifying opens a connection to the relay, so only do it when configured.
  const transport = mailerStatus.configured ? await verifyTransport() : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Your profile, security and the things this server can do."
      />

      <SettingsPanels
        profile={{
          name: session.user.name,
          email: session.user.email,
          timezone: session.user.timezone,
        }}
        mailer={{
          configured: mailerStatus.configured,
          missing: mailerStatus.missing,
          host: mailerStatus.host ?? null,
          port: mailerStatus.port ?? null,
          from: mailerStatus.from ?? null,
          verified: transport?.ok ?? false,
          verifyMessage: transport?.message ?? null,
        }}
        inboundConfigured={Boolean(process.env.EMAIL_INBOUND_SECRET)}
        sessions={sessions.map((s) => ({
          id: s.id,
          createdLabel: s.createdAt.toISOString(),
          lastUsedLabel: s.lastUsedAt.toISOString(),
          expiresLabel: s.expiresAt.toISOString(),
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
        }))}
        resumes={resumes.map((r) => ({
          id: r.id,
          label: r.label,
          summary: r.summary,
          isDefault: r.isDefault,
          jobs: r._count.jobs,
        }))}
        environment={isProduction() ? "production" : "development"}
      />
    </div>
  );
}
