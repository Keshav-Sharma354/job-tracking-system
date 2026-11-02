import { AlertTriangle } from "lucide-react";

/**
 * Shown when SMTP is not configured.
 *
 * States the consequence plainly — drafts still work, sending does not — rather
 * than letting the user discover it by pressing Send.
 */
export function MailerBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-subtle px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-warning">Email sending is not configured</p>
        <p className="mt-0.5 text-muted">
          You can write and save drafts, but nothing will leave this server until
          the <code className="font-mono text-xs">SMTP_HOST</code>,{" "}
          <code className="font-mono text-xs">SMTP_PORT</code> and{" "}
          <code className="font-mono text-xs">SMTP_FROM_EMAIL</code> environment
          variables are set and the server is restarted. For local testing, run{" "}
          <code className="font-mono text-xs">docker compose up -d mailpit</code>.
        </p>
      </div>
    </div>
  );
}
