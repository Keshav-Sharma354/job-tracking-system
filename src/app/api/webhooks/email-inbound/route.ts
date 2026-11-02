/**
 * Inbound email webhook.
 *
 * Point your mail provider's inbound webhook here and replies to your outreach
 * are recorded automatically and threaded onto the message they answer.
 *
 * Authentication is a shared secret in the `Authorization: Bearer <secret>`
 * header, compared in constant time. This is a machine-to-machine endpoint: it
 * deliberately does *not* use the session cookie, because the caller is the mail
 * provider rather than a signed-in user.
 *
 * Expected payload (all fields are validated):
 *   {
 *     "from": "dana@example.com",
 *     "to": "you@example.com",
 *     "subject": "Re: Staff Engineer at Acme",
 *     "text": "…plain text body…",
 *     "messageId": "<abc@mail.example>",
 *     "inReplyTo": "<xyz@mail.example>",
 *     "receivedAt": "2026-05-04T09:30:00.000Z"
 *   }
 *
 * Idempotent on `messageId`, so a provider retrying a delivery will not create a
 * duplicate reply.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { inboundEmailSchema } from "@/lib/validation/schemas";
import { recordInboundReply } from "@/server/services/emails";

export const dynamic = "force-dynamic";

/** Constant-time string comparison that tolerates length differences. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still perform a comparison so the timing does not leak the length.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Routes the reply to the account that sent the matching message.
 *
 * A shared secret proves the caller is allowed in, but not *which* account the
 * reply belongs to. Ownership is resolved by finding the outbound email with the
 * matching `In-Reply-To` header, then taking that email's user — so a webhook
 * for account A can never write a reply into account B.
 */
async function resolveUserId(
  messageId?: string,
  inReplyTo?: string,
): Promise<string | null> {
  const candidates = [inReplyTo, messageId].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  if (candidates.length > 0) {
    const owner = await db.email.findFirst({
      where: { messageId: { in: candidates } },
      select: { userId: true },
    });
    if (owner) return owner.userId;
  }

  return null;
}

export async function POST(request: Request) {
  const secret = getEnv().EMAIL_INBOUND_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        error: "Inbound email is not configured",
        detail:
          "Set EMAIL_INBOUND_SECRET to enable this endpoint.",
      },
      { status: 501 },
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (!secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = inboundEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const userId = await resolveUserId(
    parsed.data.messageId,
    parsed.data.inReplyTo,
  );

  if (!userId) {
    // Deliberately a 202: the provider's delivery succeeded and retrying will
    // not change the outcome, and a 4xx would make it retry forever.
    return NextResponse.json(
      {
        recorded: false,
        reason:
          "No matching outbound message was found for this reply. It was not recorded.",
      },
      { status: 202 },
    );
  }

  const result = await recordInboundReply(userId, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    {
      recorded: true,
      emailId: result.data.emailId,
      threaded: result.data.threaded,
      message: result.message,
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      endpoint: "email-inbound",
      method: "POST",
      authentication: "Authorization: Bearer <EMAIL_INBOUND_SECRET>",
      enabled: Boolean(getEnv().EMAIL_INBOUND_SECRET),
    },
    { status: 200 },
  );
}
