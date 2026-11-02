/**
 * Cookie-backed adapter over the session store, plus the Data Access Layer
 * that every server-side read and mutation is expected to call first.
 *
 * `requireSession()` is the security boundary of the application: anything that
 * runs after it receives a `userId` that has already been verified against the
 * database, and every repository call is scoped by that id.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  createSessionRecord,
  deleteSessionRecord,
  resolveSession,
  type ActiveSession,
} from "@/lib/auth/session-core";

export { SESSION_COOKIE_NAME };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/** Client IP for the session audit trail; safe when no proxy header is present. */
export async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

async function requestUserAgent(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("user-agent");
  } catch {
    return null;
  }
}

/** Signs the user in by creating a session row and setting the cookie. */
export async function startSession(userId: string): Promise<void> {
  const { token, session } = await createSessionRecord({
    userId,
    userAgent: await requestUserAgent(),
    ipAddress: await requestIp(),
  });
  await setSessionCookie(token, session.expiresAt);
}

/** Signs the user out: the database row is removed, not just the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionRecord(token);
  }
  await clearSessionCookie();
}

/**
 * Reads the current session.
 *
 * Wrapped in React's `cache` so that a single render pass performs at most one
 * session lookup no matter how many components ask for it. Server Actions and
 * Route Handlers are not part of a render pass, so for those the function runs
 * on each call — which is the behaviour we want for freshness.
 */
export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return resolveSession(token);
});

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * The authorization gate for pages and server components. Redirects to the sign
 * in page when there is no valid session.
 */
export const requireSession = cache(async (): Promise<ActiveSession> => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

/**
 * The authorization gate for server actions and route handlers. Throws instead
 * of redirecting, because a redirect inside a mutation produces a confusing
 * double-submit for the client.
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session.userId;
}

/** Minimal user projection. Never widen this to include secrets. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, timezone: true },
  });
});
