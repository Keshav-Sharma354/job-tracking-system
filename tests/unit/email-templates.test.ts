import { describe, expect, it } from "vitest";
import {
  buildTemplateVars,
  extractVariables,
  renderTemplate,
  tidyGreeting,
} from "@/server/email/templates";

describe("extractVariables", () => {
  it("finds every distinct placeholder across subject and body", () => {
    expect(
      extractVariables("Hi {{firstName}}", "Role at {{company}} — {{firstName}}"),
    ).toEqual(["company", "firstName"]);
  });

  it("tolerates whitespace inside the braces", () => {
    expect(extractVariables("{{  firstName  }}")).toEqual(["firstName"]);
  });

  it("returns an empty list when there are no placeholders", () => {
    expect(extractVariables("plain text")).toEqual([]);
  });

  it("ignores braces that are not valid variable syntax", () => {
    expect(extractVariables("{{with-hyphen}} {{ }} {{unclosed")).toEqual([]);
  });

  it("allows whitespace inside the braces", () => {
    expect(extractVariables("{{  spaced  }}")).toEqual(["spaced"]);
  });
});

describe("renderTemplate", () => {
  it("substitutes known variables", () => {
    expect(
      renderTemplate("Hi {{firstName}}, about {{company}}?", {
        firstName: "Dana",
        company: "Acme",
      }),
    ).toBe("Hi Dana, about Acme?");
  });

  it("leaves unknown placeholders in place so typos are visible", () => {
    const rendered = renderTemplate("Hi {{firstNmae}}", { firstName: "Dana" });
    expect(rendered).toBe("Hi {{firstNmae}}");
  });

  it("substitutes an empty string for a variable bound to an empty string", () => {
    expect(renderTemplate("[{{role}}]", { role: "" })).toBe("[]");
  });

  it("substitutes nothing for null and undefined bindings", () => {
    expect(renderTemplate("[{{a}}][{{b}}]", { a: null, b: undefined })).toBe(
      "[{{a}}][{{b}}]",
    );
  });

  it("handles a placeholder appearing multiple times", () => {
    expect(
      renderTemplate("{{name}} and {{name}}", { name: "Sam" }),
    ).toBe("Sam and Sam");
  });
});

describe("buildTemplateVars", () => {
  it("splits the contact name into first and last", () => {
    const vars = buildTemplateVars({
      contact: { name: "Dana Whitfield" },
    });
    expect(vars.firstName).toBe("Dana");
    expect(vars.lastName).toBe("Whitfield");
    expect(vars.contactName).toBe("Dana Whitfield");
  });

  it("uses a single name for both first and last", () => {
    const vars = buildTemplateVars({ contact: { name: "Prince" } });
    expect(vars.firstName).toBe("Prince");
    expect(vars.lastName).toBe("");
  });

  it("falls back to the job's company when the contact has none", () => {
    const vars = buildTemplateVars({
      contact: { name: "Dana", company: null },
      job: { title: "Staff Engineer", company: { name: "Globex" } },
    });
    expect(vars.company).toBe("Globex");
    expect(vars.jobTitle).toBe("Staff Engineer");
  });

  it("prefers the contact's company over the job's", () => {
    const vars = buildTemplateVars({
      contact: { name: "Dana", company: { name: "Acme" } },
      job: { title: "Engineer", company: { name: "Globex" } },
    });
    expect(vars.company).toBe("Acme");
  });

  it("produces empty strings rather than undefined when data is missing", () => {
    const vars = buildTemplateVars({});
    expect(vars.firstName).toBe("");
    expect(vars.company).toBe("");
    expect(vars.jobTitle).toBe("");
  });

  it("exposes the sender name under both aliases", () => {
    const vars = buildTemplateVars({ senderName: "Alex" });
    expect(vars.senderName).toBe("Alex");
    expect(vars.myName).toBe("Alex");
  });
});

describe("tidyGreeting", () => {
  it("leaves the greeting alone when a first name is known", () => {
    expect(tidyGreeting("Hi Dana,", "Dana")).toBe("Hi Dana,");
  });

  it("replaces a dangling comma when the first name is unknown", () => {
    expect(tidyGreeting("Hello,", "")).toBe("Hello there,");
    expect(tidyGreeting("Hi,", "")).toBe("Hi there,");
  });

  it("does nothing when there is no greeting line", () => {
    expect(tidyGreeting("Body text", "")).toBe("Body text");
  });
});
