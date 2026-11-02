/**
 * Session token generation and hashing.
 *
 * The browser receives a 256-bit random opaque token. Only its SHA-256 digest is
 * persisted, so an attacker with read access to the `Session` table cannot mint
 * a cookie that the server accepts.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests of equal expected length. */
export function safeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
