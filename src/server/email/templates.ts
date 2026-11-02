/**
 * Template variable rendering for cold outreach.
 *
 * Syntax: `{{variable_name}}`. Unknown variables are left untouched rather than
 * blanked, so a typo is visible in the preview instead of silently producing
 * "Hello ," in an email that is about to be sent to a real person.
 */

export type TemplateVars = Record<string, string | null | undefined>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Lists every distinct `{{variable}}` referenced by a subject/body pair. */
export function extractVariables(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
      found.add(match[1]!);
    }
  }
  return [...found].sort();
}

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(VARIABLE_PATTERN, (whole, name: string) => {
    const value = vars[name];
    // Leaving the placeholder in place makes the miss obvious in the preview.
    return value === undefined || value === null ? whole : value;
  });
}

/** Variables resolved from the data available for a given recipient. */
export function buildTemplateVars(input: {
  contact?: {
    name: string | null;
    title?: string | null;
    company?: { name: string | null } | null;
  } | null;
  job?: {
    title: string | null;
    company?: { name: string | null } | null;
  } | null;
  senderName?: string | null;
}): TemplateVars {
  const contactName = input.contact?.name?.trim() ?? "";
  const contactCompany = input.contact?.company?.name ?? input.job?.company?.name ?? "";

  return {
    firstName: contactName ? contactName.split(/\s+/)[0]! : "",
    lastName: contactName.split(/\s+/).slice(1).join(" "),
    contactName,
    contactTitle: input.contact?.title ?? "",
    contactCompany,
    company: contactCompany,
    jobTitle: input.job?.title ?? "",
    role: input.job?.title ?? "",
    senderName: input.senderName ?? "",
    myName: input.senderName ?? "",
  };
}

/**
 * Strips the greeting line when a first name is unknown, so the email does not
 * begin with "Hello ," in the one case where that would look obviously broken.
 */
export function tidyGreeting(rendered: string, firstName: string): string {
  if (firstName) return rendered;
  return rendered.replace(/^(hi|hello|hey|dear)\s*,/i, "$1 there,");
}
