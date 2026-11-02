/**
 * Session storage and lifecycle.
 *
 * Deliberately free of any Next.js imports: this module is exercised directly by
 * the test suite, and the cookie layer (`./session.ts`) is a thin adapter over it.
 */
import { db } from "@/lib/db";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/token";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "jts_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  expiresAt: Date;
  user: SessionUser;
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** Absolute session lifetime in milliseconds. */
export function sessionTtlMs(): number {
  return getEnv().SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Issues a new session and returns the raw token. The caller is responsible for
 * writing the token into a cookie; only the digest reaches the database.
 */
export async function createSessionRecord(input: CreateSessionInput): Promise<{
  token: string;
  session: { id: string; expiresAt: Date };
}> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  const session = await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: input.userId,
      expiresAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
    select: { id: true, expiresAt: true },
  });

  return { token, session };
}

/**
 * Resolves a raw token to its owner.
 *
 * Expired sessions are treated as absent *and* deleted, so a stale cookie cannot
 * keep an account's session count inflated. Sessions that are past the halfway
 * point of their lifetime are extended, giving sliding expiry without a write on
 * every single request.
 */
export async function resolveSession(
  token: string | undefined | null,
): Promise<ActiveSession | null> {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);

  const record = await db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, timezone: true } },
    },
  });

  if (!record) return null;

  if (record.expiresAt.getTime() <= Date.now()) {
    await db.session
      .delete({ where: { id: record.id } })
      .catch(() => undefined);
    return null;
  }

  const ttl = sessionTtlMs();
  const halfLife = record.createdAt.getTime() + ttl / 2;

  if (Date.now() >= halfLife) {
    const expiresAt = new Date(Date.now() + ttl);
    await db.session
      .update({
        where: { id: record.id },
        data: { expiresAt, lastUsedAt: new Date() },
      })
      .catch(() => undefined);
    record.expiresAt = expiresAt;
  } else {
    // Best-effort; failure here must never fail the request.
    await db.session
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: record.id,
    userId: record.userId,
    expiresAt: record.expiresAt,
    user: record.user,
  };
}

export async function deleteSessionRecord(token: string): Promise<void> {
  await db.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}

/** Used by "sign out everywhere" and by password changes. */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/** Housekeeping for deployments where the scheduler may not run. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

export async function listUserSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
    },
  });
}
