/**
 * Field definitions for the application form.
 *
 * Kept in one place so the create and edit dialogs cannot drift — an option list
 * that changes in one but not the other is a classic source of silent bugs.
 */
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_META,
  WORK_MODE_LABELS,
} from "@/lib/constants";
import type { FieldSpec } from "@/components/ui/resource-form";
import { toDateTimeInputValue } from "@/lib/utils/date";

export interface JobFormOptions {
  companies: { id: string; name: string }[];
  resumeVersions: { id: string; label: string }[];
  referralContacts: { id: string; name: string }[];
}

export interface JobFormDefaults {
  companyId?: string | null;
  title?: string | null;
  url?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workMode?: string | null;
  status?: string | null;
  priority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  appliedAt?: Date | string | null;
  deadlineAt?: Date | string | null;
  resumeVersionId?: string | null;
  referralContactId?: string | null;
  notes?: string | null;
  tags?: string[] | null;
}

export function jobFormFields(
  defaults: JobFormDefaults,
  options: JobFormOptions,
): FieldSpec[] {
  return [
    {
      name: "companyId",
      label: "Company",
      type: "select",
      span: 6,
      placeholder: "Select a company",
      defaultValue: defaults.companyId ?? "",
      hint: "Or leave this blank and type a new company name below.",
      options: options.companies.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: "companyName",
      label: "…or new company",
      type: "text",
      span: 6,
      placeholder: "e.g. Northwind Labs",
      hint: "Creating an application for a new company adds it for you.",
    },
    {
      name: "title",
      label: "Job title",
      type: "text",
      required: true,
      span: 12,
      placeholder: "e.g. Staff Platform Engineer",
      defaultValue: defaults.title ?? "",
    },
    {
      name: "url",
      label: "Posting URL",
      type: "url",
      span: 6,
      placeholder: "https://…",
      defaultValue: defaults.url ?? "",
    },
    {
      name: "location",
      label: "Location",
      type: "text",
      span: 6,
      placeholder: "Berlin, DE / Remote (EU)",
      defaultValue: defaults.location ?? "",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      span: 4,
      defaultValue: defaults.status ?? "SAVED",
      options: APPLICATION_STATUSES.map((s) => ({
        value: s,
        label: STATUS_META[s].label,
      })),
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      span: 4,
      defaultValue: defaults.priority ?? "MEDIUM",
      options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "employmentType",
      label: "Employment type",
      type: "select",
      span: 4,
      defaultValue: defaults.employmentType ?? "FULL_TIME",
      options: Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "workMode",
      label: "Work mode",
      type: "select",
      span: 4,
      placeholder: "Not specified",
      defaultValue: defaults.workMode ?? "",
      options: Object.entries(WORK_MODE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "resumeVersionId",
      label: "Resume version",
      type: "select",
      span: 4,
      placeholder: "Not specified",
      defaultValue: defaults.resumeVersionId ?? "",
      options: options.resumeVersions.map((r) => ({
        value: r.id,
        label: r.label,
      })),
    },
    {
      name: "referralContactId",
      label: "Referred by",
      type: "select",
      span: 4,
      placeholder: "No referral",
      defaultValue: defaults.referralContactId ?? "",
      options: options.referralContacts.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    },
    {
      name: "salaryMin",
      label: "Salary from",
      type: "number",
      span: 3,
      min: 0,
      placeholder: "120000",
      defaultValue: defaults.salaryMin != null ? String(defaults.salaryMin) : "",
    },
    {
      name: "salaryMax",
      label: "Salary to",
      type: "number",
      span: 3,
      min: 0,
      placeholder: "150000",
      defaultValue: defaults.salaryMax != null ? String(defaults.salaryMax) : "",
    },
    {
      name: "salaryCurrency",
      label: "Currency",
      type: "text",
      span: 3,
      placeholder: "EUR",
      maxLength: 3,
      hint: "ISO code",
      defaultValue: defaults.salaryCurrency ?? "EUR",
    },
    {
      name: "salaryPeriod",
      label: "Per",
      type: "select",
      span: 3,
      defaultValue: defaults.salaryPeriod ?? "YEAR",
      options: [
        { value: "YEAR", label: "Year" },
        { value: "MONTH", label: "Month" },
        { value: "HOUR", label: "Hour" },
        { value: "DAY", label: "Day" },
      ],
    },
    {
      name: "appliedAt",
      label: "Applied on",
      type: "datetime-local",
      span: 6,
      hint: "Leave blank until you apply.",
      defaultValue: toDateTimeInputValue(defaults.appliedAt ?? null) || null,
    },
    {
      name: "deadlineAt",
      label: "Application deadline",
      type: "datetime-local",
      span: 6,
      defaultValue: toDateTimeInputValue(defaults.deadlineAt ?? null) || null,
    },
    {
      name: "tags",
      label: "Tags",
      type: "tags",
      span: 12,
      placeholder: "referral, remote, fintech",
      hint: "Comma separated. Used for filtering and source reporting.",
      defaultValue: (defaults.tags ?? []).join(", "),
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      span: 12,
      placeholder: "What stood out? Who do you know there? What do you want to remember before the interview?",
      defaultValue: defaults.notes ?? "",
    },
  ];
}
