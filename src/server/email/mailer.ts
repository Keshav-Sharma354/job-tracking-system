/**
 * Outbound mail transport.
 *
 * Design rules, in priority order:
 *
 *  1. **Never simulate.** If SMTP is not configured, `sendMail` throws
 *     `MailerNotConfiguredError`. It does not log-and-succeed, and it does not
 *     mark the message as sent. The UI reflects this by disabling the send
 *     action rather than pretending the message left the building.
 *  2. **Fail loudly and record why.** Real transport errors are surfaced on the
 *     message row and in the delivery log so a bounce is diagnosable.
 *  3. **Verify first.** SMTP credentials are tested once at startup (lazily) so
 *     a misconfiguration is discovered on the first send rather than silently
 *     producing an unverifiable message.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/env";

export class MailerNotConfiguredError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Email is not configured. Missing: ${missing.join(", ")}. ` +
        "Set the SMTP_* environment variables and restart the server.",
    );
    this.name = "MailerNotConfiguredError";
    this.missing = missing;
  }
}

export class MailDeliveryError extends Error {
  readonly code: string;

  constructor(message: string, code = "SEND_FAILED") {
    super(message);
    this.name = "MailDeliveryError";
    this.code = code;
  }
}

export interface OutgoingMail {
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  replyTo?: string | null;
  /** RFC 5322 Message-ID of the message being replied to. */
  inReplyTo?: string | null;
  /** Stable Message-ID we generate so inbound replies can be threaded. */
  messageId?: string | null;
}

export interface MailerStatus {
  configured: boolean;
  missing: string[];
  host?: string;
  port?: number;
  from?: string;
}

let cachedTransporter: Transporter | null = null;

/** Which required variables are present. Used to disable the UI affordance. */
export function getMailerStatus(): MailerStatus {
  const env = getEnv();
  const missing: string[] = [];

  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_PORT) missing.push("SMTP_PORT");
  if (!env.SMTP_FROM_EMAIL) missing.push("SMTP_FROM_EMAIL");

  if (missing.length > 0) return { configured: false, missing };

  return {
    configured: true,
    missing: [],
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.SMTP_FROM_EMAIL,
  };
}

export function isMailerConfigured(): boolean {
  return getMailerStatus().configured;
}

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const status = getMailerStatus();
  if (!status.configured) {
    throw new MailerNotConfiguredError(status.missing);
  }

  const env = getEnv();

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Implicit TLS on 465, STARTTLS elsewhere.
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? {
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        }
      : {}),
    pool: true,
    maxConnections: 3,
    // Fail fast rather than hanging a server action on an unreachable relay.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return cachedTransporter;
}

/**
 * Delivers a message through the configured SMTP relay.
 *
 * Resolves with the provider-assigned Message-ID. Any failure throws, so the
 * caller can record the message as failed rather than sent.
 */
export async function sendMail(
  mail: OutgoingMail,
): Promise<{ messageId: string; accepted: string[]; response: string }> {
  const env = getEnv();
  const transporter = getTransporter();

  const fromName = env.SMTP_FROM_NAME?.trim();
  const from = fromName
    ? `"${fromName.replace(/"/g, "")}" <${env.SMTP_FROM_EMAIL}>`
    : env.SMTP_FROM_EMAIL!;

  try {
    const info = await transporter.sendMail({
      from,
      to: mail.toName ? `"${mail.toName.replace(/"/g, "")}" <${mail.to}>` : mail.to,
      subject: mail.subject,
      text: mail.body,
      html: toHtml(mail.body),
      ...(env.SMTP_FROM_EMAIL ? { replyTo: env.SMTP_FROM_EMAIL } : {}),
      ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo } : {}),
      ...(mail.messageId ? { messageId: mail.messageId } : {}),
    });

    return {
      messageId: info.messageId,
      accepted: info.accepted ?? [mail.to],
      response: info.response ?? "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "SEND_FAILED";
    throw new MailDeliveryError(message, code);
  }
}

/**
 * Very small text → HTML conversion for the HTML part of a message.
 * Escapes HTML first so no user- or template-supplied text can inject markup.
 */
export function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 1em">${block.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#18181b">\n${paragraphs}\n</div>`;
}

/** Verifies connectivity. Used by the health endpoint and the settings page. */
export async function verifyTransport(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!isMailerConfigured()) {
    const status = getMailerStatus();
    return {
      ok: false,
      message: `Not configured (missing ${status.missing.join(", ")})`,
    };
  }

  try {
    await getTransporter().verify();
    const status = getMailerStatus();
    return {
      ok: true,
      message: `Connected to ${status.host}:${status.port}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/** Test helper: drops the cached transporter so config changes take effect. */
export function resetTransporter(): void {
  cachedTransporter = null;
}
