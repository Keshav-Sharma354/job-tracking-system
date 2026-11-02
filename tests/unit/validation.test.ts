import { describe, expect, it } from "vitest";
import {
  blankToNull,
  checkboxField,
  flattenIssues,
  optionalEmail,
  optionalInteger,
  optionalUrl,
  tagsField,
} from "@/lib/validation/fields";
import {
  companySchema,
  contactSchema,
  jobSchema,
  registerSchema,
  taskSchema,
} from "@/lib/validation/schemas";

describe("blankToNull", () => {
  it.each([
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
    ["  x  ", "x"],
  ])("maps %j to %j", (input, expected) => {
    expect(blankToNull(input)).toBe(expected);
  });
});

describe("optionalEmail", () => {
  it("normalises case and whitespace", () => {
    expect(optionalEmail.parse("  Dana@Example.COM ")).toBe("dana@example.com");
  });

  it("treats an empty field as null rather than failing", () => {
    expect(optionalEmail.parse("")).toBeNull();
    expect(optionalEmail.parse("   ")).toBeNull();
  });

  it("accepts an omitted field", () => {
    expect(optionalEmail.parse(undefined)).toBeNull();
  });

  // A malformed value is reported rather than silently discarded, so the user
  // is never told a bad input was saved.
  it("rejects an unparsable value", () => {
    expect(optionalEmail.safeParse("not-an-email").success).toBe(false);
  });
});

describe("optionalUrl", () => {
  it("adds https:// to a bare domain", () => {
    expect(optionalUrl.parse("linkedin.com/in/dana")).toBe(
      "https://linkedin.com/in/dana",
    );
  });

  it("keeps an explicit scheme", () => {
    expect(optionalUrl.parse("http://example.com")).toBe("http://example.com");
  });

  it("maps empty input to null", () => {
    expect(optionalUrl.parse("")).toBeNull();
  });

  it("accepts an omitted field", () => {
    expect(optionalUrl.parse(undefined)).toBeNull();
  });

  // These end up in `href` attributes, so a script URL must never survive.
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "rejects the dangerous scheme %j",
    (value) => {
      expect(optionalUrl.safeParse(value).success).toBe(false);
    },
  );

  it("rejects a value that cannot be a host", () => {
    expect(optionalUrl.safeParse("not a url").success).toBe(false);
  });
});

describe("optionalInteger", () => {
  it("parses numeric strings", () => {
    expect(optionalInteger({ min: 0 }).parse("120000")).toBe(120000);
  });

  it("maps empty input to null", () => {
    expect(optionalInteger().parse("")).toBeNull();
  });

  it("rejects non-numeric text", () => {
    expect(optionalInteger().safeParse("lots").success).toBe(false);
  });

  it("rejects a decimal salary", () => {
    expect(optionalInteger().safeParse("12.5").success).toBe(false);
  });

  it("accepts an omitted field", () => {
    expect(optionalInteger().parse(undefined)).toBeNull();
  });

  it("enforces bounds", () => {
    expect(optionalInteger({ min: 0 }).safeParse("-1").success).toBe(false);
    expect(optionalInteger({ max: 10 }).safeParse("11").success).toBe(false);
  });
});

describe("checkboxField", () => {
  it("maps an absent or empty submission to false", () => {
    expect(checkboxField.parse(undefined)).toBe(false);
    expect(checkboxField.parse("")).toBe(false);
  });

  it.each(["on", "true", "1", true])("maps %j to true", (value) => {
    expect(checkboxField.parse(value)).toBe(true);
  });
});

describe("tagsField", () => {
  it("splits a comma separated string", () => {
    expect(tagsField.parse("remote, fintech")).toEqual(["remote", "fintech"]);
  });

  it("accepts an array from an API client", () => {
    expect(tagsField.parse(["remote", "fintech"])).toEqual(["remote", "fintech"]);
  });

  it("normalises case and removes duplicates", () => {
    expect(tagsField.parse("Remote, remote, REMOTE")).toEqual(["remote"]);
  });

  it("accepts an omitted field", () => {
    expect(tagsField.parse(undefined)).toEqual([]);
  });

  it("drops empty segments", () => {
    expect(tagsField.parse("a,,b,")).toEqual(["a", "b"]);
  });

  it("returns an empty list for blank input", () => {
    expect(tagsField.parse("")).toEqual([]);
  });

  it("enforces the maximum tag count", () => {
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`).join(",");
    expect(tagsField.safeParse(many).success).toBe(false);
  });

  it("enforces the maximum tag length", () => {
    expect(tagsField.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("flattenIssues", () => {
  it("maps each field to its first message", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "nope",
      password: "short",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const flat = flattenIssues(result.error);
    expect(Object.keys(flat)).toContain("email");
    expect(Object.keys(flat)).toContain("password");
    expect(Object.keys(flat)).toContain("confirmPassword");
    expect(flat.email).toMatch(/valid email/i);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Dana Whitfield",
    email: "dana@example.com",
    password: "LongEnough123",
    confirmPassword: "LongEnough123",
  };

  it("accepts a well-formed payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the password to be at least 12 characters", () => {
    const r = registerSchema.safeParse({ ...valid, password: "Short1A", confirmPassword: "Short1A" });
    expect(r.success).toBe(false);
  });

  it("requires mixed case and a digit", () => {
    expect(registerSchema.safeParse({ ...valid, password: "alllowercase123", confirmPassword: "alllowercase123" }).success).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "Different123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(flattenIssues(r.error).confirmPassword).toMatch(/do not match/i);
    }
  });

  it("lower-cases the email", () => {
    const r = registerSchema.safeParse({ ...valid, email: "  DANA@Example.COM " });
    expect(r.success && r.data.email).toBe("dana@example.com");
  });
});

describe("jobSchema", () => {
  const base = {
    title: "Staff Engineer",
    companyName: "Acme",
    employmentType: "FULL_TIME",
    status: "APPLIED",
    priority: "HIGH",
    tags: "",
  };

  it("accepts a company typed by name", () => {
    expect(jobSchema.safeParse(base).success).toBe(true);
  });

  it("requires a company id or a name", () => {
    const r = jobSchema.safeParse({ ...base, companyName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects a minimum salary above the maximum", () => {
    const r = jobSchema.safeParse({ ...base, salaryMin: "200000", salaryMax: "100000" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(flattenIssues(r.error).salaryMax).toMatch(/cannot exceed/i);
    }
  });

  it("accepts a single-sided salary range", () => {
    expect(jobSchema.safeParse({ ...base, salaryMin: "100000" }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, salaryMax: "100000" }).success).toBe(true);
  });

  it("parses datetime-local input into a Date", () => {
    const r = jobSchema.safeParse({ ...base, appliedAt: "2026-05-04T09:30" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.appliedAt).toBeInstanceOf(Date);
      expect(r.data.appliedAt!.toISOString()).toBe("2026-05-04T09:30:00.000Z");
    }
  });

  it("maps an empty optional field to null instead of ''", () => {
    const r = jobSchema.safeParse({ ...base, url: "", notes: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.url).toBeNull();
      expect(r.data.notes).toBeNull();
    }
  });

  it("rejects an unknown status", () => {
    expect(jobSchema.safeParse({ ...base, status: "PENDING" }).success).toBe(false);
  });

  it("applies the pipeline default when status is omitted", () => {
    const r = jobSchema.safeParse({ ...base, status: undefined });
    expect(r.success && r.data.status).toBe("SAVED");
  });
});

describe("contactSchema", () => {
  it("accepts a contact with only a name", () => {
    const r = contactSchema.safeParse({ name: "Dana" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBeNull();
      expect(r.data.contactType).toBe("OTHER");
    }
  });

  it("normalises the email address", () => {
    const r = contactSchema.safeParse({ name: "Dana", email: " DANA@Example.com " });
    expect(r.success && r.data.email).toBe("dana@example.com");
  });

  it("rejects an invalid relationship strength", () => {
    expect(contactSchema.safeParse({ name: "Dana", relationship: "BESTIE" }).success).toBe(
      false,
    );
  });
});

describe("taskSchema", () => {
  it("requires a title", () => {
    expect(taskSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("accepts a task with no due date", () => {
    const r = taskSchema.safeParse({ title: "Call recruiter", dueAt: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dueAt).toBeNull();
  });
});

describe("companySchema", () => {
  it("requires a name", () => {
    expect(companySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("normalises the website url", () => {
    const r = companySchema.safeParse({ name: "Acme", websiteUrl: "acme.com" });
    expect(r.success && r.data.websiteUrl).toBe("https://acme.com");
  });
});
