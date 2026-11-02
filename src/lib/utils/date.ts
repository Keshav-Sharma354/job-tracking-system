/**
 * Date helpers.
 *
 * All date maths runs in UTC. The only place a user's timezone matters is
 * deciding whether a task is "due today", which is handled by
 * `isDueOnDateInZone` using the IANA zone stored on the user record.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses a value that may already be a Date or an ISO string. */
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Start of the user's local day, expressed in UTC. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  // en-CA yields YYYY-MM-DD, which Date parses as UTC midnight.
  return new Date(`${parts}T00:00:00.000Z`);
}

/**
 * True when both instants fall on the same calendar day *in the user's zone*.
 * This is the correct comparison for a "due today" reminder, because 17:00 UTC
 * on the 3rd is already the 4th in Auckland.
 */
export function isDueOnDateInZone(
  value: Date,
  reference: Date,
  timeZone: string,
): boolean {
  return (
    startOfDayInZone(value, timeZone).getTime() ===
    startOfDayInZone(reference, timeZone).getTime()
  );
}

/** Whole days from `from` to `to`, negative when `to` is in the past. */
export function daysUntil(to: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(to, from);
}

export type DueState = "overdue" | "today" | "tomorrow" | "upcoming" | "later";

/**
 * Classifies a due date.
 *
 * Defaults to UTC so that server and client render the same label for the same
 * instant; pass the user's IANA zone to align with their local calendar.
 */
export function dueState(
  dueAt: Date,
  now: Date = new Date(),
  timeZone = "UTC",
): DueState {
  const today = startOfDayInZone(now, timeZone).getTime();
  const dueDay = startOfDayInZone(dueAt, timeZone).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((dueDay - today) / dayMs);

  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "upcoming";
  return "later";
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** `May 4, 2026` */
export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : "—";
}

/** `May 4, 2026, 2:30 PM` */
export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  return d ? DATE_TIME_FMT.format(d) : "—";
}

/**
 * Compact relative label for dense tables: `in 3d`, `2d overdue`, `today`.
 * Defaults to UTC for deterministic server rendering.
 */
export function formatRelativeDue(
  value: Date | string | null | undefined,
  now: Date = new Date(),
  timeZone = "UTC",
): string {
  const d = toDate(value);
  if (!d) return "—";

  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round(
    (startOfDayInZone(d, timeZone).getTime() -
      startOfDayInZone(now, timeZone).getTime()) /
      dayMs,
  );

  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 30) return `in ${diff}d`;
  return DATE_FMT.format(d);
}

/**
 * `2026-05-04` for `<input type="date">`.
 *
 * Formatted in UTC deliberately: the server renders these inputs and the client
 * submits them back. Using the server's local zone here would make the value
 * shift by a day depending on where the app runs.
 */
export function toDateInputValue(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** `2026-05-04T09:30` for `<input type="datetime-local">`, in UTC. */
export function toDateTimeInputValue(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Safe default for seeding a datetime-local input, e.g. `now + 1 day`. */
export function nowDateTimeInputValue(offsetDays = 0): string {
  return toDateTimeInputValue(new Date(Date.now() + offsetDays * MS_PER_DAY));
}

/** `2026-05-04T09:30:00.000Z` — the exact string a datetime-local input posts. */
export function fromDateTimeInputValue(value: string): Date | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Builds a URLSearchParams object, dropping empty values. */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
