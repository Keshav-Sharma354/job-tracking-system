/**
 * Domain constants shared by the UI, the validators and the analytics layer.
 *
 * Keeping these in one place means the Kanban board, the status filter and the
 * CSV export can never disagree about what a status is called or where it sits
 * in the pipeline.
 */
import {
  ActivityAction,
  ActivityEntity,
  ApplicationStatus,
  ContactType,
  EmailCategory,
  EmailStatus,
  EmploymentType,
  NoteType,
  Priority,
  RelationshipStrength,
  TaskPriority,
  TaskStatus,
  TaskType,
  WorkMode,
} from "@/generated/prisma/enums";

export {
  ActivityAction,
  ActivityEntity,
  ApplicationStatus,
  ContactType,
  EmailCategory,
  EmailStatus,
  EmploymentType,
  NoteType,
  Priority,
  RelationshipStrength,
  TaskPriority,
  TaskStatus,
  TaskType,
  WorkMode,
};

// ---------------------------------------------------------------------------
// Application pipeline
// ---------------------------------------------------------------------------

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the status pill, tuned to stay legible in both themes. */
  badge: string;
  /** Tailwind classes for the Kanban column accent. */
  accent: string;
  description: string;
  /** Terminal stages are excluded from the "active pipeline" count. */
  terminal: boolean;
}

/**
 * Declaration order is the pipeline order, so a Kanban board can render columns
 * by iterating this array.
 */
export const APPLICATION_STATUS_ORDER = [
  ApplicationStatus.SAVED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.PHONE_SCREEN,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.ONSITE,
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUS_ORDER)[number];

export const APPLICATION_STATUSES = APPLICATION_STATUS_ORDER;

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  [ApplicationStatus.SAVED]: {
    label: "Saved",
    badge: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-700",
    accent: "bg-slate-400",
    description: "Bookmarked but not yet applied",
    terminal: false,
  },
  [ApplicationStatus.APPLIED]: {
    label: "Applied",
    badge: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800",
    accent: "bg-sky-500",
    description: "Application submitted, awaiting response",
    terminal: false,
  },
  [ApplicationStatus.PHONE_SCREEN]: {
    label: "Phone Screen",
    badge: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800",
    accent: "bg-violet-500",
    description: "Recruiter screening call in progress",
    terminal: false,
  },
  [ApplicationStatus.INTERVIEW]: {
    label: "Interview",
    badge: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
    accent: "bg-amber-500",
    description: "Interviews being scheduled or completed",
    terminal: false,
  },
  [ApplicationStatus.ONSITE]: {
    label: "Onsite",
    badge: "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-800",
    accent: "bg-orange-500",
    description: "Final round or onsite loop",
    terminal: false,
  },
  [ApplicationStatus.OFFER]: {
    label: "Offer",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800",
    accent: "bg-emerald-500",
    description: "Offer received, negotiating or deciding",
    terminal: false,
  },
  [ApplicationStatus.HIRED]: {
    label: "Hired",
    badge: "bg-green-100 text-green-800 ring-green-200 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-800",
    accent: "bg-green-500",
    description: "Offer accepted",
    terminal: true,
  },
  [ApplicationStatus.REJECTED]: {
    label: "Rejected",
    badge: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800",
    accent: "bg-red-500",
    description: "Closed out without an offer",
    terminal: true,
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: "Withdrawn",
    badge: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-400 dark:ring-zinc-700",
    accent: "bg-zinc-500",
    description: "You pulled out of the process",
    terminal: true,
  },
};

/** Statuses that still represent a live application. */
export const ACTIVE_STATUSES = APPLICATION_STATUSES.filter(
  (s) => !STATUS_META[s].terminal,
);

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return STATUS_META[status].terminal;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const labelMap = <T extends string>(
  entries: readonly { value: T; label: string }[],
): Record<T, string> =>
  Object.fromEntries(entries.map((e) => [e.value, e.label])) as Record<T, string>;

export const EMPLOYMENT_TYPE_LABELS = labelMap([
  { value: EmploymentType.FULL_TIME, label: "Full-time" },
  { value: EmploymentType.PART_TIME, label: "Part-time" },
  { value: EmploymentType.CONTRACT, label: "Contract" },
  { value: EmploymentType.INTERNSHIP, label: "Internship" },
  { value: EmploymentType.TEMPORARY, label: "Temporary" },
]) as Record<EmploymentType, string>;

export const WORK_MODE_LABELS = labelMap([
  { value: WorkMode.ONSITE, label: "On-site" },
  { value: WorkMode.HYBRID, label: "Hybrid" },
  { value: WorkMode.REMOTE, label: "Remote" },
]) as Record<WorkMode, string>;

export const PRIORITY_LABELS = labelMap([
  { value: Priority.LOW, label: "Low" },
  { value: Priority.MEDIUM, label: "Medium" },
  { value: Priority.HIGH, label: "High" },
]) as Record<Priority, string>;

export const PRIORITY_BADGES: Record<Priority, string> = {
  [Priority.LOW]: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700",
  [Priority.MEDIUM]: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
  [Priority.HIGH]: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800",
};

export const CONTACT_TYPE_LABELS = labelMap([
  { value: ContactType.RECRUITER, label: "Recruiter" },
  { value: ContactType.HR, label: "HR" },
  { value: ContactType.HIRING_MANAGER, label: "Hiring Manager" },
  { value: ContactType.ENGINEER, label: "Engineer" },
  { value: ContactType.ENGINEERING_MANAGER, label: "Engineering Manager" },
  { value: ContactType.DIRECTOR, label: "Director" },
  { value: ContactType.REFERRAL, label: "Employee Referral" },
  { value: ContactType.OTHER, label: "Other" },
]) as Record<ContactType, string>;

export const RELATIONSHIP_LABELS = labelMap([
  { value: RelationshipStrength.UNKNOWN, label: "Unknown" },
  { value: RelationshipStrength.WEAK, label: "Weak" },
  { value: RelationshipStrength.MODERATE, label: "Moderate" },
  { value: RelationshipStrength.STRONG, label: "Strong" },
]) as Record<RelationshipStrength, string>;

export const EMAIL_CATEGORY_LABELS = labelMap([
  { value: EmailCategory.COLD_OUTREACH, label: "Cold Outreach" },
  { value: EmailCategory.RECRUITER_REPLY, label: "Recruiter Reply" },
  { value: EmailCategory.FOLLOW_UP, label: "Follow-up" },
  { value: EmailCategory.REFERRAL_REQUEST, label: "Referral Request" },
  { value: EmailCategory.THANK_YOU, label: "Thank You" },
  { value: EmailCategory.INTERVIEW_CONFIRMATION, label: "Interview Confirmation" },
  { value: EmailCategory.NEGOTIATION, label: "Negotiation" },
  { value: EmailCategory.OTHER, label: "Other" },
]) as Record<EmailCategory, string>;

export const EMAIL_STATUS_LABELS = labelMap([
  { value: EmailStatus.DRAFT, label: "Draft" },
  { value: EmailStatus.SCHEDULED, label: "Scheduled" },
  { value: EmailStatus.SENT, label: "Sent" },
  { value: EmailStatus.REPLIED, label: "Replied" },
  { value: EmailStatus.BOUNCED, label: "Bounced" },
  { value: EmailStatus.FAILED, label: "Failed" },
]) as Record<EmailStatus, string>;

export const EMAIL_STATUS_BADGES: Record<EmailStatus, string> = {
  [EmailStatus.DRAFT]: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700",
  [EmailStatus.SCHEDULED]: "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-800",
  [EmailStatus.SENT]: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800",
  [EmailStatus.REPLIED]: "bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-800",
  [EmailStatus.BOUNCED]: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800",
  [EmailStatus.FAILED]: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800",
};

export const TASK_TYPE_LABELS = labelMap([
  { value: TaskType.FOLLOW_UP, label: "Follow-up" },
  { value: TaskType.INTERVIEW, label: "Interview" },
  { value: TaskType.APPLY, label: "Apply" },
  { value: TaskType.CALL, label: "Call" },
  { value: TaskType.EMAIL, label: "Email" },
  { value: TaskType.MEETING, label: "Meeting" },
  { value: TaskType.RESEARCH, label: "Research" },
  { value: TaskType.OTHER, label: "Other" },
]) as Record<TaskType, string>;

export const TASK_STATUS_LABELS = labelMap([
  { value: TaskStatus.OPEN, label: "Open" },
  { value: TaskStatus.DONE, label: "Done" },
  { value: TaskStatus.CANCELLED, label: "Cancelled" },
]) as Record<TaskStatus, string>;

export const TASK_PRIORITY_LABELS = labelMap([
  { value: TaskPriority.LOW, label: "Low" },
  { value: TaskPriority.MEDIUM, label: "Medium" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.URGENT, label: "Urgent" },
]) as Record<TaskPriority, string>;

export const TASK_PRIORITY_BADGES: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700",
  [TaskPriority.MEDIUM]: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800",
  [TaskPriority.HIGH]: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
  [TaskPriority.URGENT]: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800",
};

export const NOTE_TYPE_LABELS = labelMap([
  { value: NoteType.GENERAL, label: "General" },
  { value: NoteType.INTERVIEW, label: "Interview" },
  { value: NoteType.COMPANY_RESEARCH, label: "Company Research" },
  { value: NoteType.CONVERSATION, label: "Conversation" },
  { value: NoteType.SCREENING, label: "Screening" },
  { value: NoteType.REFERRAL, label: "Referral" },
]) as Record<NoteType, string>;

/** Fields that can be attached to an entity as free-form tags. */
export const TAG_MAX_LENGTH = 40;
export const TAG_MAX_COUNT = 20;

/** Follow-up cadence used by the "suggest follow-up" helpers, in days. */
export const FOLLOW_UP_SLA_DAYS = {
  APPLICATION_AFTER_APPLY: 7,
  AFTER_EMAIL_SENT: 5,
  AFTER_INTERVIEW: 3,
  AFTER_RECRUITER_REPLY: 2,
} as const;
