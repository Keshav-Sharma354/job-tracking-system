/**
 * Reusable Zod field builders.
 *
 * HTML forms cannot express "absent" — an untouched text input submits an empty
 * string, and an omitted key arrives as `undefined`. These builders normalise
 * both to `null` so that an empty field clears a column instead of storing `""`.
 *
 * A value that *is* supplied but malformed is reported as a validation error
 * rather than silently discarded, so a user never loses input without being told.
 */
import { z } from "zod";
import { TAG_MAX_COUNT, TAG_MAX_LENGTH } from "@/lib/constants";

export const MAX_TEXT = 200;
export const MAX_LONG_TEXT = 10_000;

/** Trim a value; treat `undefined`, `null` and blank strings alike. */
export function blankToNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export function blankToUndefined(v: unknown): string | undefined {
  return blankToNull(v) ?? undefined;
}

/**
 * Lets a schema accept an omitted form field.
 *
 * In Zod 4 the `optin` flag that makes a field accept `undefined` is lost once
 * `.transform()`/`.refine()` are chained onto it, so an absent field would fail
 * with `invalid_type` instead of being treated as "no value". Normalising a
 * missing key to `""` first restores the intended behaviour; each builder then
 * runs `blankToNull` to turn that back into `null`.
 */
function fromForm<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === undefined || value === null ? "" : value),
    schema,
  );
}

/** Only http(s) links are accepted; blocks `javascript:` and `data:` payloads. */
const httpUrl = z.url().refine(
  (value) => /^https?:\/\//i.test(value),
  "Enter an http or https URL",
);

export const optionalText = (max = MAX_TEXT) =>
  fromForm(z.string().max(max, `Must be ${max} characters or fewer`).transform(blankToNull));

export const requiredText = (max = MAX_TEXT, label = "This field") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalEmail = fromForm(
  z
    .string()
    .max(254)
    .transform((value) => blankToNull(value)?.toLowerCase() ?? null)
    .pipe(z.email("Enter a valid email address").nullable()),
);

/**
 * A URL that may be pasted without a scheme ("linkedin.com/in/x").
 * `example.com` becomes `https://example.com` rather than being rejected.
 */
export const optionalUrl = fromForm(
  z
    .string()
    .max(2000)
    .transform(blankToNull)
    .transform((value) =>
      value === null
        ? null
        : /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)
          ? value
          : `https://${value}`,
    )
    .pipe(httpUrl.nullable()),
);

/**
 * Parses the value of an `<input type="datetime-local">` or `type="date"`.
 *
 * A bare `2026-05-04T09:30` has no timezone designator, and `new Date()` would
 * interpret it in the *server's* local zone. Since `toDateTimeInputValue` writes
 * these strings in UTC they must be read back as UTC, or a round trip silently
 * shifts every timestamp by the server's offset.
 *
 * Returns `null` for values that are not a real instant, including dates that
 * merely look valid — `2026-02-31` would otherwise roll over into March.
 */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const bare = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    trimmed,
  );

  if (bare) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = bare;
    const millis = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    );
    const date = new Date(millis);

    // Rejects 31 February and similar overflows by comparing the round trip.
    const roundTrips =
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(mo) - 1 &&
      date.getUTCDate() === Number(d);

    return roundTrips ? date : null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Shared shape for optional date fields: parse, report failure as a validation
 * message, and still yield `Date | null`.
 *
 * The intermediate `{ ok, value }` wrapper keeps the *output* type clean —
 * signalling failure with a sentinel such as `NaN` would leak `number` into every
 * downstream type.
 */
const optionalDateField = (message: string) =>
  fromForm(
    z
      .string()
      .transform(blankToNull)
      .transform((value) => {
        if (value === null) return { ok: true as const, value: null };
        const parsed = parseDateInput(value);
        return parsed === null
          ? ({ ok: false as const, value: null })
          : ({ ok: true as const, value: parsed });
      })
      .refine((result) => result.ok, { message })
      .transform((result) => result.value)
      .nullable(),
  );

/** Accepts an ISO string or a `Date`; empty input becomes `null`. */
export const optionalDate = optionalDateField("Enter a valid date");

/**
 * `datetime-local` inputs submit `2026-05-04T09:30`. See `parseDateInput` for
 * why the parse is pinned to UTC and why impossible dates are rejected.
 */
export const optionalDateTime = optionalDateField(
  "Enter a valid date and time",
);

export const requiredDateTime = z
  .string()
  .trim()
  .min(1, "A date is required")
  .transform((value) => {
    const parsed = parseDateInput(value);
    return { ok: parsed !== null, value: parsed };
  })
  .refine((result) => result.ok, { message: "Enter a valid date and time" })
  .transform((result) => result.value);

export const optionalInteger = (opts?: { min?: number; max?: number }) =>
  fromForm(
    z
      .string()
      .transform(blankToNull)
      .transform((value) => (value === null ? null : Number(value)))
      .refine((value) => value === null || Number.isInteger(value), {
        message: "Enter a whole number",
      })
      .refine(
        (value) =>
          value === null ||
          ((opts?.min === undefined || value >= opts.min) &&
            (opts?.max === undefined || value <= opts.max)),
        opts?.min !== undefined && opts?.max !== undefined
          ? `Enter a number between ${opts.min} and ${opts.max}`
          : "Value out of range",
      )
      .nullable(),
  );

/**
 * Parses a tag field that may arrive either as a comma-separated string from a
 * form or as an array from an API client.
 */
export const tagsField = fromForm(
  z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : value.split(",")))
    .transform((list) =>
      list
        .flatMap((t) => t.split(","))
        // Lower-case before de-duplicating so "Remote" and "remote" collapse.
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    )
    .refine((list) => list.length <= TAG_MAX_COUNT, {
      message: `Use at most ${TAG_MAX_COUNT} tags`,
    })
    .refine((list) => list.every((t) => t.length <= TAG_MAX_LENGTH), {
      message: `Tags must be ${TAG_MAX_LENGTH} characters or fewer`,
    })
    .transform((list) => Array.from(new Set(list))),
);

/**
 * Accepts `<select multiple>` (an array of strings) or a single string, and maps
 * it onto an enum.
 */
export function enumField<T extends readonly [string, ...string[]]>(
  values: T,
  label = "value",
) {
  return z
    .string()
    .trim()
    .refine((v) => (values as readonly string[]).includes(v), {
      message: `Invalid ${label}`,
    })
    .transform((v) => v as T[number]);
}

/**
 * Checkbox semantics: present means true, absent means false. An unchecked
 * checkbox is simply not submitted, so `undefined` has to be accepted.
 */
export const checkboxField = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => value === true || value === "on" || value === "true" || value === "1");

/** A UUID reference to another record, or `null` when nothing is selected. */
export const optionalId = fromForm(
  z
    .string()
    .transform(blankToNull)
    .pipe(z.uuid("Invalid identifier").nullable()),
);

/** Flattens a Zod error into `{ fieldName: firstMessage }` for form rendering. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
