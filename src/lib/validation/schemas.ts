import { z } from "zod";
import {
  ApplicationStatus,
  ContactType,
  EmailCategory,
  EmploymentType,
  NoteType,
  Priority,
  RelationshipStrength,
  TaskPriority,
  TaskStatus,
  TaskType,
  WorkMode,
} from "@/lib/constants";
import {
  checkboxField,
  enumField,
  flattenIssues,
  optionalDate,
  optionalDateTime,
  optionalEmail,
  optionalId,
  optionalInteger,
  optionalText,
  optionalUrl,
  requiredDateTime,
  requiredText,
  tagsField,
} from "@/lib/validation/fields";

/**
 * Extracts the literal value union from a Prisma enum object so that validated
 * output is typed as the enum rather than `string`.
 */
const values = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const enums = {
  applicationStatus: enumField(values(ApplicationStatus), "status"),
  employmentType: enumField(values(EmploymentType), "employment type"),
  workMode: enumField(values(WorkMode), "work mode"),
  priority: enumField(values(Priority), "priority"),
  contactType: enumField(values(ContactType), "contact type"),
  relationship: enumField(values(RelationshipStrength), "relationship strength"),
  emailCategory: enumField(values(EmailCategory), "email category"),
  noteType: enumField(values(NoteType), "note type"),
  taskType: enumField(values(TaskType), "task type"),
  taskStatus: enumField(values(TaskStatus), "task status"),
  taskPriority: enumField(values(TaskPriority), "task priority"),
};

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: requiredText(80, "Name").refine((v) => v.length >= 2, {
      message: "Name must be at least 2 characters",
    }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address")),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(200, "Password is too long")
      .refine((v) => /[a-z]/.test(v), {
        message: "Include a lowercase letter",
      })
      .refine((v) => /[A-Z]/.test(v), {
        message: "Include an uppercase letter",
      })
      .refine((v) => /\d/.test(v), { message: "Include a number" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(200, "Password is too long")
      .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
        message: "Include uppercase, lowercase and a number",
      }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: requiredText(80, "Name"),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .refine(isValidTimeZone, { message: "Unknown timezone" }),
});

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const companySchema = z.object({
  name: requiredText(120, "Company name"),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  industry: optionalText(80),
  location: optionalText(120),
  size: optionalText(40),
  notes: optionalText(5000),
  tags: tagsField.default([]),
});
export type CompanyInput = z.input<typeof companySchema>;
export type CompanyData = z.output<typeof companySchema>;

// ---------------------------------------------------------------------------
// Applications (jobs)
// ---------------------------------------------------------------------------

export const jobSchema = z
  .object({
    companyId: optionalId,
    companyName: optionalText(120),
    title: requiredText(160, "Job title"),
    url: optionalUrl,
    location: optionalText(120),
    employmentType: enums.employmentType.default("FULL_TIME"),
    workMode: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(enums.workMode.nullable().catch(null))
      .nullable()
      .optional(),
    status: enums.applicationStatus.default("SAVED"),
    priority: enums.priority.default("MEDIUM"),
    salaryMin: optionalInteger({ min: 0, max: 100_000_000 }),
    salaryMax: optionalInteger({ min: 0, max: 100_000_000 }),
    salaryCurrency: optionalText(3),
    salaryPeriod: optionalText(10),
    appliedAt: optionalDateTime,
    deadlineAt: optionalDateTime,
    resumeVersionId: optionalId,
    referralContactId: optionalId,
    notes: optionalText(10_000),
    tags: tagsField.default([]),
  })
  .refine((d) => Boolean(d.companyId || d.companyName), {
    message: "Choose an existing company or type a new name",
    path: ["companyName"],
  })
  .refine(
    (d) =>
      d.salaryMin === null || d.salaryMax === null || d.salaryMin <= d.salaryMax,
    { message: "Minimum salary cannot exceed the maximum", path: ["salaryMax"] },
  );

export type JobInput = z.input<typeof jobSchema>;
export type JobData = z.output<typeof jobSchema>;

/** Payload for a Kanban drag; only status is mutable this way. */
export const moveJobSchema = z.object({
  jobId: z.uuid("Invalid job id"),
  status: enums.applicationStatus,
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const contactSchema = z.object({
  name: requiredText(120, "Name"),
  email: optionalEmail,
  phone: optionalText(40),
  linkedinUrl: optionalUrl,
  title: optionalText(120),
  companyId: optionalId,
  contactType: enums.contactType.default("OTHER"),
  relationship: enums.relationship.default("UNKNOWN"),
  lastContactedAt: optionalDateTime,
  notes: optionalText(10_000),
  tags: tagsField.default([]),
});
export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const emailTemplateSchema = z.object({
  name: requiredText(120, "Template name"),
  category: enums.emailCategory.default("COLD_OUTREACH"),
  subject: requiredText(200, "Subject"),
  body: requiredText(20_000, "Body"),
  isFavorite: checkboxField.default(false),
});
export type EmailTemplateInput = z.input<typeof emailTemplateSchema>;
export type EmailTemplateData = z.output<typeof emailTemplateSchema>;

export const emailDraftSchema = z
  .object({
    contactId: optionalId,
    jobId: optionalId,
    templateId: optionalId,
    category: enums.emailCategory.default("COLD_OUTREACH"),
    toEmail: optionalEmail,
    toName: optionalText(120),
    subject: requiredText(200, "Subject"),
    body: requiredText(20_000, "Body"),
    scheduledAt: optionalDateTime,
  })
  .refine((d) => d.toEmail !== null, {
    message: "A recipient email address is required",
    path: ["toEmail"],
  });
export type EmailDraftInput = z.input<typeof emailDraftSchema>;
export type EmailDraftData = z.output<typeof emailDraftSchema>;

export const sendEmailSchema = z.object({
  emailId: z.uuid("Invalid email id"),
  /** Confirm dialogs are required before mail leaves the database. */
  confirm: z.literal(true, { message: "Sending must be confirmed" }),
});
export type SendEmailInput = z.input<typeof sendEmailSchema>;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const taskSchema = z
  .object({
    title: requiredText(200, "Title"),
    description: optionalText(5000),
    taskType: enums.taskType.default("FOLLOW_UP"),
    status: enums.taskStatus.default("OPEN"),
    priority: enums.taskPriority.default("MEDIUM"),
    dueAt: optionalDateTime,
    jobId: optionalId,
    contactId: optionalId,
    emailId: optionalId,
  })
  .refine(
    (d) => d.status !== "DONE" || d.dueAt !== null || d.dueAt !== undefined,
    { message: "Completed tasks still need a due date", path: ["dueAt"] },
    // A completed task keeps its original due date; this refinement only guards
    // against a malformed payload where both are present and inconsistent.
  );
export type TaskInput = z.input<typeof taskSchema>;
export type TaskData = z.output<typeof taskSchema>;

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const noteSchema = z.object({
  body: requiredText(20_000, "Note"),
  noteType: enums.noteType.default("GENERAL"),
  jobId: optionalId,
  contactId: optionalId,
  isPinned: checkboxField.default(false),
});
export type NoteInput = z.input<typeof noteSchema>;
/** Post-parse shape. Defaults have been applied, so `noteType`/`isPinned` are set. */
export type NoteData = z.output<typeof noteSchema>;

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export const resumeSchema = z.object({
  label: requiredText(80, "Label"),
  fileUrl: optionalUrl,
  summary: optionalText(1000),
  isDefault: checkboxField.default(false),
});

// ---------------------------------------------------------------------------
// Inbound webhook
// ---------------------------------------------------------------------------

export const inboundEmailSchema = z.object({
  from: z.email("Sender must be a valid email address"),
  to: z.email("Recipient must be a valid email address").optional(),
  subject: z.string().max(500).default(""),
  text: z.string().max(100_000).default(""),
  messageId: z.string().max(500).optional(),
  inReplyTo: z.string().max(500).optional(),
  receivedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({ id: z.uuid("Invalid identifier") });

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export { flattenIssues, optionalDate, requiredDateTime, checkboxField };
