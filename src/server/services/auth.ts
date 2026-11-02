/**
 * Authentication service.
 *
 * Two properties matter here and both are tested:
 *
 *  - **No user enumeration.** An unknown email and a wrong password produce the
 *    same message and take a comparable amount of time, because the unknown
 *    email path still performs an Argon2 verification.
 *  - **Throttling.** Attempts are rate limited per IP and per account so a
 *    credential-stuffing run cannot proceed unthrottled.
 */
import { db, isUniqueConstraintError } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  fakeVerifyDelay,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { deleteAllUserSessions } from "@/lib/auth/session-core";
import { checkRateLimit, resetRateLimit } from "@/server/auth/rate-limit";
import {
  fail,
  internal,
  ok,
  unauthorized,
} from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const REGISTER_LIMIT = 5;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;

const GENERIC_CREDENTIAL_ERROR = "Email or password is incorrect";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  timezone: true,
} as const;

export function isRegistrationEnabled(): boolean {
  return getEnv().ALLOW_REGISTRATION;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  ipAddress: string | null;
}): Promise<ActionResult<PublicUser>> {
  const { ipAddress } = input;

  const ipLimit = checkRateLimit(`register:ip:${ipAddress ?? "unknown"}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!ipLimit.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many sign-up attempts. Try again in ${Math.ceil(ipLimit.retryAfterSeconds / 60)} minutes.`,
    );
  }

  const emailLimit = checkRateLimit(`register:email:${input.email}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!emailLimit.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many sign-up attempts for this address. Try again in ${Math.ceil(emailLimit.retryAfterSeconds / 60)} minutes.`,
    );
  }

  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    // Deliberately vague: do not confirm that the address is registered.
    return fail("CONFLICT", "That email address cannot be used");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await db.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: publicUserSelect,
    });

    resetRateLimit(`register:email:${input.email}`);

    return ok(user, "Account created");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail("CONFLICT", "That email address cannot be used");
    }
    console.error("registerUser failed", error);
    return internal("Could not create your account");
  }
}

export async function authenticate(
  email: string,
  password: string,
  ipAddress: string | null,
): Promise<ActionResult<PublicUser>> {
  const ipKey = `login:ip:${ipAddress ?? "unknown"}`;
  const emailKey = `login:email:${email}`;

  const ipLimit = checkRateLimit(ipKey, LOGIN_LIMIT * 3, LOGIN_WINDOW_MS);
  if (!ipLimit.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many sign-in attempts. Try again in ${Math.ceil(ipLimit.retryAfterSeconds / 60)} minutes.`,
    );
  }

  const emailLimit = checkRateLimit(emailKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!emailLimit.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many failed attempts for this account. Try again in ${Math.ceil(emailLimit.retryAfterSeconds / 60)} minutes.`,
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { ...publicUserSelect, passwordHash: true },
  });

  if (!user) {
    // Burn equivalent CPU so timing does not reveal that the account is absent.
    await fakeVerifyDelay();
    return unauthorized(GENERIC_CREDENTIAL_ERROR);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return unauthorized(GENERIC_CREDENTIAL_ERROR);
  }

  resetRateLimit(emailKey);
  resetRateLimit(ipKey);

  // Drop the hash before returning; callers only ever need the public fields.
  return ok(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
    },
  );
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; password: string },
): Promise<ActionResult<{ id: string }>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) return unauthorized();

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    return fail("VALIDATION", "Your current password is incorrect", {
      currentPassword: "Your current password is incorrect",
    });
  }

  const passwordHash = await hashPassword(input.password);

  await db.user.update({ where: { id: userId }, data: { passwordHash } });

  // A password change invalidates every other session, then the caller starts a
  // fresh one for the device that made the change.
  await deleteAllUserSessions(userId);

  return ok({ id: userId }, "Password updated. Other devices have been signed out.");
}

export async function updateProfile(
  userId: string,
  input: { name: string; timezone: string },
): Promise<ActionResult<PublicUser>> {
  const user = await db.user.update({
    where: { id: userId },
    data: { name: input.name, timezone: input.timezone },
    select: publicUserSelect,
  });
  return ok(user, "Profile updated");
}

export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    select: publicUserSelect,
  });
}
