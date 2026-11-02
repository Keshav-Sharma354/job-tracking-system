"use client";

import { ContactType } from "@/lib/constants";
import type { FieldSpec } from "@/components/ui/resource-form";
import { toDateTimeInputValue } from "@/lib/utils/date";

export interface ContactFormOptions {
  companies: { id: string; name: string }[];
}

export function contactFormFields(
  defaults: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    title?: string | null;
    companyId?: string | null;
    contactType?: string | null;
    relationship?: string | null;
    lastContactedAt?: Date | string | null;
    notes?: string | null;
    tags?: string[] | null;
  },
  options: ContactFormOptions,
): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Full name",
      type: "text",
      required: true,
      span: 6,
      placeholder: "e.g. Amara Osei",
      defaultValue: defaults.name ?? "",
    },
    {
      name: "title",
      label: "Job title",
      type: "text",
      span: 6,
      placeholder: "Senior Technical Recruiter",
      defaultValue: defaults.title ?? "",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      span: 6,
      placeholder: "name@company.com",
      hint: "Required before you can send them an email.",
      defaultValue: defaults.email ?? "",
    },
    {
      name: "phone",
      label: "Phone",
      type: "tel",
      span: 6,
      placeholder: "+44 20 7946 0000",
      defaultValue: defaults.phone ?? "",
    },
    {
      name: "linkedinUrl",
      label: "LinkedIn",
      type: "url",
      span: 6,
      placeholder: "linkedin.com/in/…",
      defaultValue: defaults.linkedinUrl ?? "",
    },
    {
      name: "companyId",
      label: "Company",
      type: "select",
      span: 6,
      placeholder: "No company",
      defaultValue: defaults.companyId ?? "",
      options: options.companies.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: "contactType",
      label: "Role",
      type: "select",
      span: 6,
      defaultValue: defaults.contactType ?? ContactType.OTHER,
      options: Object.entries({
        RECRUITER: "Recruiter",
        HR: "HR",
        HIRING_MANAGER: "Hiring manager",
        ENGINEER: "Engineer",
        ENGINEERING_MANAGER: "Engineering manager",
        DIRECTOR: "Director",
        REFERRAL: "Employee referral",
        OTHER: "Other",
      }).map(([value, label]) => ({ value, label })),
    },
    {
      name: "relationship",
      label: "Relationship strength",
      type: "select",
      span: 6,
      defaultValue: defaults.relationship ?? "UNKNOWN",
      options: [
        { value: "UNKNOWN", label: "Unknown" },
        { value: "WEAK", label: "Weak" },
        { value: "MODERATE", label: "Moderate" },
        { value: "STRONG", label: "Strong" },
      ],
    },
    {
      name: "lastContactedAt",
      label: "Last contacted",
      type: "datetime-local",
      span: 6,
      defaultValue:
        toDateTimeInputValue(defaults.lastContactedAt ?? null) || null,
    },
    {
      name: "tags",
      label: "Tags",
      type: "tags",
      span: 12,
      placeholder: "referral, alumni",
      defaultValue: (defaults.tags ?? []).join(", "),
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      span: 12,
      placeholder: "How you know them, what they're like to deal with, anything to follow up on.",
      defaultValue: defaults.notes ?? "",
    },
  ];
}
