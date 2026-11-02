/**
 * Result type used by every server action.
 *
 * Server actions must not throw for expected failures: a thrown error crosses the
 * network boundary as an opaque digest that the client cannot render. Returning a
 * discriminated union keeps validation failures, "not found" and conflicts
 * distinguishable in the UI.
 */
import { flattenIssues } from "@/lib/validation/fields";
import type { z } from "zod";

export interface FieldErrors {
  [field: string]: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code: ActionErrorCode; fieldErrors?: FieldErrors };

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "MAILER_NOT_CONFIGURED"
  | "SEND_FAILED"
  | "NOT_CONFIGURED"
  | "INTERNAL";

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function okEmpty(message?: string): ActionResult<undefined> {
  return { ok: true, data: undefined, message };
}

export function fail(
  code: ActionErrorCode,
  error: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> {
  return { ok: false, code, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

export function invalid(
  error: z.ZodError | string,
): ActionResult<never> {
  return typeof error === "string"
    ? fail("VALIDATION", error)
    : fail("VALIDATION", "Please correct the highlighted fields", flattenIssues(error));
}

/**
 * A validation failure attributed to one form field — used by services that
 * discover a problem (a foreign key that no longer resolves, a name clash) after
 * schema validation has already passed.
 */
export function fieldError<T = never>(
  field: string,
  message: string,
): ActionResult<T> {
  return {
    ok: false,
    code: "VALIDATION",
    error: message,
    fieldErrors: { [field]: message },
  };
}

export const unauthorized = (message = "You must sign in to continue") =>
  fail("UNAUTHORIZED", message);

export const notFound = (message = "That record no longer exists") =>
  fail("NOT_FOUND", message);

export const conflict = (message: string) => fail("CONFLICT", message);

export const internal = (message = "Something went wrong") =>
  fail("INTERNAL", message);
