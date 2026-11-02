/**
 * CSV export and import.
 *
 *   GET  /api/export?entity=applications   download a CSV
 *   GET  /api/export?entity=contacts
 *   GET  /api/export?entity=tasks
 *   GET  /api/export?entity=notes
 *   POST /api/export?entity=applications   import a CSV (multipart upload)
 *   POST /api/export?entity=contacts
 *
 * Both directions are scoped to the authenticated user's records. Import is
 * partial-success: each row is validated and applied independently, and the
 * response reports exactly which rows failed and why, rather than rejecting the
 * whole file because of one bad line.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { z } from "zod";
import { toCsv, parseCsv, createHeaderLookup, pick } from "@/lib/utils/csv";
import { listJobsForExport } from "@/server/repo/jobs";
import { listContacts } from "@/server/repo/contacts";
import { listAllTasks } from "@/server/repo/tasks";
import { listNotes } from "@/server/repo/notes";
import { createApplication } from "@/server/services/jobs";
import { createContact } from "@/server/services/contacts";
import { parseDateInput } from "@/lib/validation/fields";
import {
  CONTACT_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  NOTE_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_META,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const ENTITIES = ["applications", "contacts", "tasks", "notes"] as const;
type Entity = (typeof ENTITIES)[number];

const entitySchema = z.enum(ENTITIES);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const APPLICATION_COLUMNS = [
  "company",
  "title",
  "status",
  "priority",
  "location",
  "work_mode",
  "employment_type",
  "url",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_period",
  "applied_at",
  "deadline_at",
  "resume",
  "referred_by",
  "tags",
  "notes",
  "created_at",
] as const;

const CONTACT_COLUMNS = [
  "name",
  "email",
  "phone",
  "linkedin",
  "title",
  "contact_type",
  "relationship",
  "company",
  "last_contacted_at",
  "tags",
  "notes",
  "created_at",
] as const;

const TASK_COLUMNS = [
  "title",
  "type",
  "priority",
  "status",
  "due_at",
  "application",
  "contact",
  "description",
  "created_at",
] as const;

const NOTE_COLUMNS = [
  "body",
  "type",
  "application",
  "contact",
  "pinned",
  "created_at",
] as const;

/** `2026-05-04T09:30` — a value the import parser can read back. */
function csvDate(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

async function buildCsv(userId: string, entity: Entity): Promise<{
  csv: string;
  filename: string;
}> {
  const stamp = new Date().toISOString().slice(0, 10);

  switch (entity) {
    case "applications": {
      const jobs = await listJobsForExport(userId);
      const rows = jobs.map((job) => ({
        company: job.company.name,
        title: job.title,
        status: STATUS_META[job.status].label,
        priority: job.priority,
        location: job.location ?? "",
        work_mode: job.workMode ?? "",
        employment_type: EMPLOYMENT_TYPE_LABELS[job.employmentType],
        url: job.url ?? "",
        salary_min: job.salaryMin?.toString() ?? "",
        salary_max: job.salaryMax?.toString() ?? "",
        salary_currency: job.salaryCurrency,
        salary_period: job.salaryPeriod,
        applied_at: csvDate(job.appliedAt),
        deadline_at: csvDate(job.deadlineAt),
        resume: job.resumeVersion?.label ?? "",
        referred_by: job.referralContact?.name ?? "",
        tags: job.tags.join(", "),
        notes: job.notes ?? "",
        created_at: csvDate(job.createdAt),
      }));
      return { csv: toCsv(rows, APPLICATION_COLUMNS), filename: `applications-${stamp}.csv` };
    }

    case "contacts": {
      const contacts = await listContacts(userId, { pageSize: 500 });
      const rows = contacts.items.map((contact) => ({
        name: contact.name,
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        linkedin: contact.linkedinUrl ?? "",
        title: contact.title ?? "",
        contact_type: CONTACT_TYPE_LABELS[contact.contactType],
        relationship: contact.relationship,
        company: contact.company?.name ?? "",
        last_contacted_at: csvDate(contact.lastContactedAt),
        tags: contact.tags.join(", "),
        notes: contact.notes ?? "",
        created_at: csvDate(contact.createdAt),
      }));
      return { csv: toCsv(rows, CONTACT_COLUMNS), filename: `contacts-${stamp}.csv` };
    }

    case "tasks": {
      const tasks = await listAllTasks(userId, {});
      const rows = tasks.map((task) => ({
        title: task.title,
        type: TASK_TYPE_LABELS[task.taskType],
        priority: TASK_PRIORITY_LABELS[task.priority],
        status: task.status,
        due_at: csvDate(task.dueAt),
        application: task.job?.title ?? "",
        contact: task.contact?.name ?? "",
        description: task.description ?? "",
        created_at: csvDate(task.createdAt),
      }));
      return { csv: toCsv(rows, TASK_COLUMNS), filename: `tasks-${stamp}.csv` };
    }

    case "notes": {
      const notes = await listNotes(userId, { pageSize: 1000 });
      const rows = notes.items.map((note) => ({
        body: note.body,
        type: NOTE_TYPE_LABELS[note.noteType],
        application: note.job?.title ?? "",
        contact: note.contact?.name ?? "",
        pinned: note.isPinned ? "yes" : "",
        created_at: csvDate(note.createdAt),
      }));
      return { csv: toCsv(rows, NOTE_COLUMNS), filename: `notes-${stamp}.csv` };
    }
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = entitySchema.safeParse(url.searchParams.get("entity") ?? "applications");
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Unknown entity. Use one of: ${ENTITIES.join(", ")}` },
      { status: 400 },
    );
  }

  const { csv, filename } = await buildCsv(session.userId, parsed.data);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

/**
 * Accepts either a human label ("Phone Screen") or the raw enum value
 * ("PHONE_SCREEN"), so a CSV exported by this app re-imports cleanly and a
 * hand-written one can be either.
 */
function labelToEnum<K extends string>(
  labels: Record<K, string>,
): (value: string) => K | null {
  const table = new Map<string, K>(
    (Object.entries(labels) as [K, string][]).map(([key, label]) => [
      label.toLowerCase(),
      key,
    ]),
  );

  return (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const byLabel = table.get(trimmed.toLowerCase());
    if (byLabel) return byLabel;

    const normalised = trimmed.toUpperCase().replace(/[\s-]+/g, "_") as K;
    return Object.prototype.hasOwnProperty.call(labels, normalised)
      ? normalised
      : null;
  };
}

const STATUS_LABEL_TO_ENUM = labelToEnum(
  Object.fromEntries(
    Object.entries(STATUS_META).map(([key, meta]) => [key, meta.label]),
  ) as Record<ApplicationStatus, string>,
);

const PRIORITY_LABEL_TO_ENUM = labelToEnum(PRIORITY_LABELS);

function lookupFor(headers: string[]) {
  const lookup = createHeaderLookup(headers);
  return (name: string) => lookup(name);
}

async function importApplications(
  userId: string,
  csv: string,
): Promise<ImportSummary> {
  const { rows, headers, errors } = parseCsv(csv);
  const summary: ImportSummary = { created: 0, skipped: 0, errors: [...errors] };
  const headerLookup = lookupFor(headers);

  for (const [index, row] of rows.slice(0, MAX_ROWS).entries()) {
    const rowNumber = index + 2; // +1 for the header row, +1 for 1-based lines
    const get = (...names: string[]) => pick(row, headerLookup, ...names);

    const companyName = get("company", "company name") ?? "";
    const title = get("title", "job title", "role") ?? "";

    if (!companyName || !title) {
      summary.skipped += 1;
      summary.errors.push(`Row ${rowNumber}: company and title are both required`);
      continue;
    }

    const statusLabel = get("status", "stage");
    const priorityLabel = get("priority");
    const employmentLabel = get("employment_type", "employment type");

    const result = await createApplication(userId, {
      companyId: null,
      companyName,
      title,
      url: get("url", "job url", "link") ?? "",
      location: get("location") ?? "",
      employmentType:
        (employmentLabel ? EMPLOYMENT_TYPE_LABEL_TO_ENUM(employmentLabel) : null) ??
        "FULL_TIME",
      workMode: null,
      status: (statusLabel ? STATUS_LABEL_TO_ENUM(statusLabel) : null) ?? "SAVED",
      priority: (priorityLabel ? PRIORITY_LABEL_TO_ENUM(priorityLabel) : null) ?? "MEDIUM",
      salaryMin: parseNumber(get("salary_min", "salary from")),
      salaryMax: parseNumber(get("salary_max", "salary to")),
      salaryCurrency: get("salary_currency", "currency") ?? "USD",
      salaryPeriod: "YEAR",
      appliedAt: parseDateInput(get("applied_at", "applied", "applied at") ?? ""),
      deadlineAt: parseDateInput(get("deadline_at", "deadline") ?? ""),
      resumeVersionId: null,
      referralContactId: null,
      notes: get("notes") ?? "",
      tags: splitTags(get("tags")),
    });

    if (result.ok) {
      summary.created += 1;
    } else {
      summary.skipped += 1;
      summary.errors.push(`Row ${rowNumber}: ${result.error}`);
    }
  }

  if (rows.length > MAX_ROWS) {
    summary.errors.push(
      `Only the first ${MAX_ROWS} rows were processed; ${rows.length - MAX_ROWS} were ignored.`,
    );
  }

  return summary;
}

const EMPLOYMENT_TYPE_LABEL_TO_ENUM = labelToEnum(EMPLOYMENT_TYPE_LABELS);

function splitTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function importContacts(
  userId: string,
  csv: string,
): Promise<ImportSummary> {
  const { rows, headers, errors } = parseCsv(csv);
  const summary: ImportSummary = { created: 0, skipped: 0, errors: [...errors] };
  const typeLookup = labelToEnum(CONTACT_TYPE_LABELS);

  for (const [index, row] of rows.slice(0, MAX_ROWS).entries()) {
    const rowNumber = index + 2;
    const lookup = lookupFor(headers);
    const name = pick(row, lookup, "name", "full name", "contact") ?? "";
    if (!name) {
      summary.skipped += 1;
      summary.errors.push(`Row ${rowNumber}: name is required`);
      continue;
    }

    const typeLabel = pick(row, lookup, "contact_type", "type", "role");
    const lastContacted = pick(row, lookup, "last_contacted_at", "last contacted");

    const result = await createContact(userId, {
      name,
      email: pick(row, lookup, "email", "email address") ?? "",
      phone: pick(row, lookup, "phone", "phone number") ?? "",
      linkedinUrl: pick(row, lookup, "linkedin", "linkedin profile") ?? "",
      title: pick(row, lookup, "title", "job title") ?? "",
      companyId: null,
      contactType: (typeLabel ? typeLookup(typeLabel) : null) ?? "OTHER",
      relationship:
        (pick(row, lookup, "relationship", "relationship strength")?.toUpperCase() as
          | "UNKNOWN"
          | "WEAK"
          | "MODERATE"
          | "STRONG"
          | undefined) ?? "UNKNOWN",
      lastContactedAt: parseDateInput(lastContacted ?? ""),
      notes: pick(row, lookup, "notes") ?? "",
      tags: (pick(row, lookup, "tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    if (result.ok) {
      summary.created += 1;
    } else {
      summary.skipped += 1;
      summary.errors.push(`Row ${rowNumber}: ${result.error}`);
    }
  }

  return summary;
}

interface ImportSummary {
  created: number;
  skipped: number;
  errors: string[];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedEntity = entitySchema.safeParse(url.searchParams.get("entity") ?? "applications");
  if (!parsedEntity.success) {
    return NextResponse.json(
      { error: `Unknown entity. Use one of: ${ENTITIES.join(", ")}` },
      { status: 400 },
    );
  }

  if (parsedEntity.data !== "applications" && parsedEntity.data !== "contacts") {
    return NextResponse.json(
      {
        error:
          "Import is supported for 'applications' and 'contacts'. " +
          "Export any entity with GET.",
      },
      { status: 400 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File is too large. The limit is 5 MB." },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Attach a CSV file in a 'file' field" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File is too large. The limit is 5 MB." },
      { status: 413 },
    );
  }

  const csv = await file.text();
  if (!csv.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  const summary =
    parsedEntity.data === "applications"
      ? await importApplications(session.userId, csv)
      : await importContacts(session.userId, csv);

  return NextResponse.json(
    {
      entity: parsedEntity.data,
      ...summary,
      message:
        summary.created > 0
          ? `Imported ${summary.created} ${parsedEntity.data}.${
              summary.skipped > 0 ? ` ${summary.skipped} skipped.` : ""
            }`
          : `Nothing was imported.${summary.skipped > 0 ? ` ${summary.skipped} rows skipped.` : ""}`,
    },
    { status: summary.created > 0 ? 200 : 422 },
  );
}

/** Columns the importer recognises, surfaced so the UI can describe them. */
export const IMPORT_COLUMNS = {
  applications: APPLICATION_COLUMNS,
  contacts: CONTACT_COLUMNS,
} as const;
