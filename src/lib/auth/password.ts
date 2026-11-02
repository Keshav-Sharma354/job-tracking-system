/**
 * Password hashing.
 *
 * Argon2id is the current OWASP first recommendation. `@node-rs/argon2` ships
 * prebuilt native bindings, so no compiler is required at install time.
 */
import { hash, verify } from "@node-rs/argon2";

/**
 * OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1).
 *
 * These are tuned for an interactive login on commodity hardware. If you run on
 * a very small instance, lower `memoryCost` rather than removing hashing.
 */
const OPTIONS = {
  algorithm: 2, // argon2id
  memoryCost: 19_456, // KiB => 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * A malformed or missing hash returns `false` rather than throwing, so a
 * corrupted row cannot be distinguished from a wrong password by the caller.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same CPU as a real verification. Called when no account
 * matches the submitted address so that response timing does not reveal
 * whether an email is registered.
 */
export async function fakeVerifyDelay(): Promise<void> {
  // A fixed, valid hash of an unguessable value.
  const decoy =
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Yn9xJ8sQK1oY5zZ2m3S9pQ4vQ8tR7wX0yZ1aB2cD3e";
  try {
    await verify(decoy, "timing-equalizer");
  } catch {
    // A failure here is irrelevant; we only care that the work was done.
  }
}
