import type { FieldSpec } from "@/components/ui/resource-form";

export function companyFormFields(defaults: {
  name?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  industry?: string | null;
  location?: string | null;
  size?: string | null;
  notes?: string | null;
  tags?: string[] | null;
} = {}): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Company name",
      type: "text",
      required: true,
      span: 6,
      placeholder: "e.g. Northwind Labs",
      defaultValue: defaults.name ?? "",
    },
    {
      name: "industry",
      label: "Industry",
      type: "text",
      span: 6,
      placeholder: "Developer tools",
      defaultValue: defaults.industry ?? "",
    },
    {
      name: "websiteUrl",
      label: "Website",
      type: "url",
      span: 6,
      placeholder: "acme.com",
      defaultValue: defaults.websiteUrl ?? "",
    },
    {
      name: "linkedinUrl",
      label: "LinkedIn",
      type: "url",
      span: 6,
      placeholder: "linkedin.com/company/…",
      defaultValue: defaults.linkedinUrl ?? "",
    },
    {
      name: "location",
      label: "Location",
      type: "text",
      span: 6,
      placeholder: "Berlin, DE",
      defaultValue: defaults.location ?? "",
    },
    {
      name: "size",
      label: "Company size",
      type: "text",
      span: 6,
      placeholder: "51-200",
      defaultValue: defaults.size ?? "",
    },
    {
      name: "tags",
      label: "Tags",
      type: "tags",
      span: 12,
      placeholder: "saas, devtools",
      defaultValue: (defaults.tags ?? []).join(", "),
    },
    {
      name: "notes",
      label: "Research notes",
      type: "textarea",
      span: 12,
      placeholder:
        "What does the company do? How do they operate? Who do you know there?",
      defaultValue: defaults.notes ?? "",
    },
  ];
}
