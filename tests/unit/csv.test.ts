import { describe, expect, it } from "vitest";
import {
  createHeaderLookup,
  parseCsv,
  pick,
  toCsv,
} from "@/lib/utils/csv";

describe("toCsv", () => {
  it("writes a header row and one line per record", () => {
    const csv = toCsv(
      [
        { name: "Acme", city: "Berlin" },
        { name: "Globex", city: "Austin" },
      ],
      ["name", "city"],
    );

    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("name,city");
    expect(lines[1]).toBe("Acme,Berlin");
    expect(lines[2]).toBe("Globex,Austin");
  });

  it("prefixes a UTF-8 BOM so spreadsheet apps detect the encoding", () => {
    expect(toCsv([], ["name"]).charCodeAt(0)).toBe(0xfeff);
  });

  it("quotes fields containing commas, quotes and newlines", () => {
    const csv = toCsv(
      [
        {
          notes: 'He said "maybe", then left',
          bio: "line one\nline two",
          plain: "no special chars",
        },
      ],
      ["notes", "bio", "plain"],
    );

    expect(csv).toContain('"He said ""maybe"", then left"');
    expect(csv).toContain('"line one\nline two"');
    expect(csv).toContain("plain");
  });

  it("emits an empty cell for missing keys instead of the string 'undefined'", () => {
    const csv = toCsv([{ a: "x" }], ["a", "b"]);
    expect(csv.trim().split("\r\n")[1]).toBe("x,");
  });

  // A leading '=' would otherwise execute as a formula when opened in Excel.
  // The value is prefixed with an apostrophe, which spreadsheet apps render as a
  // literal and never as a formula.
  it.each(["=1+1", "+A1", "-2", "@SUM(A1)", "\tcmd"])(
    "neutralises formula injection for %j",
    (value) => {
      const csv = toCsv([{ v: value }], ["v"]);
      const cell = csv.trim().split("\r\n")[1]!;
      expect(cell.startsWith("'")).toBe(true);
      // The character a spreadsheet would evaluate is no longer in first position.
      expect("=+-@".includes(cell[0]!)).toBe(false);
    },
  );

  it("round-trips through parseCsv", () => {
    const original = [
      { name: "Acme, Inc.", notes: 'Asked about "referral" process' },
      { name: "Ünïcødé Ltd", notes: "line one\nline two" },
    ];
    const csv = toCsv(original, ["name", "notes"]);
    const { rows } = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe("Acme, Inc.");
    expect(rows[0]!.notes).toBe('Asked about "referral" process');
    expect(rows[1]!.notes).toBe("line one\nline two");
  });
});

describe("parseCsv", () => {
  it("keys rows by the header row", () => {
    const { rows, headers } = parseCsv("title,company\nStaff Engineer,Acme");
    expect(headers).toEqual(["title", "company"]);
    expect(rows).toEqual([{ title: "Staff Engineer", company: "Acme" }]);
  });

  it("handles CRLF and a trailing newline", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("ignores blank trailing lines", () => {
    const { rows } = parseCsv("a,b\n1,2\n\n\n");
    expect(rows).toHaveLength(1);
  });

  it("supports escaped double quotes inside quoted fields", () => {
    const { rows } = parseCsv('a\n"She said ""yes"""');
    expect(rows[0]!.a).toBe('She said "yes"');
  });

  it("treats a quoted field containing newlines as a single cell", () => {
    const { rows } = parseCsv('name,notes\nAcme,"line1\nline2"');
    expect(rows[0]!.notes).toBe("line1\nline2");
  });

  it("reports rows with more values than headers instead of dropping them", () => {
    const { rows, errors } = parseCsv("a,b\n1,2,3");
    expect(errors[0]).toMatch(/Row 2 has 3 values/);
    // The extra value is still preserved so the user can see what happened.
    expect(rows).toHaveLength(1);
  });

  it("fills missing trailing values with empty strings", () => {
    const { rows } = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("strips the BOM produced by spreadsheet exports", () => {
    const { rows } = parseCsv("\uFEFFtitle\nEngineer");
    expect(rows[0]).toEqual({ title: "Engineer" });
  });

  it("flags duplicate header names", () => {
    const { errors } = parseCsv("a,a\n1,2");
    expect(errors[0]).toMatch(/duplicate column names/i);
  });

  it("names unnamed headers positionally so data is not lost", () => {
    const { headers, rows } = parseCsv("title,,url\nEngineer,x,http://x");
    expect(headers).toEqual(["title", "column_2", "url"]);
    expect(rows[0]!["column_2"]).toBe("x");
  });

  it("returns a helpful error for an empty document", () => {
    const { rows, errors } = parseCsv("");
    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/empty/i);
  });

  it("trims surrounding whitespace by default", () => {
    const { rows } = parseCsv("a,b\n  x  ,  y  ");
    expect(rows[0]).toEqual({ a: "x", b: "y" });
  });
});

describe("createHeaderLookup", () => {
  it("matches headers ignoring case, spaces and punctuation", () => {
    const lookup = createHeaderLookup(["Company Name", "Job Title", "applied_at"]);
    expect(lookup("company name")).toBe("Company Name");
    expect(lookup("CompanyName")).toBe("Company Name");
    expect(lookup("job-title")).toBe("Job Title");
    expect(lookup("APPLIED AT")).toBe("applied_at");
    expect(lookup("missing")).toBeUndefined();
  });

  it("returns the first non-empty value among several candidate headers", () => {
    const lookup = createHeaderLookup(["Company", "Company Name"]);
    const row = { Company: "", "Company Name": "Acme" };
    expect(pick(row, lookup, "Company", "Company Name")).toBe("Acme");
  });

  it("returns undefined when every candidate is blank", () => {
    const lookup = createHeaderLookup(["Company"]);
    expect(pick({ Company: "" }, lookup, "Company")).toBeUndefined();
  });
});
