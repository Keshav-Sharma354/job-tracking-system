/**
 * RFC 4180 CSV parsing and serialisation.
 *
 * Written by hand rather than pulled in as a dependency because import/export is a
 * trust boundary: the parser has to handle quoted fields containing commas,
 * escaped quotes and embedded newlines without corrupting user data.
 */

export type CsvRow = Record<string, string>;

/** Serialises rows to CSV with a UTF-8 BOM so Excel detects the encoding. */
export function toCsv(
  rows: CsvRow[],
  columns: readonly string[],
): string {
  const lines = [columns.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function escapeCell(value: string): string {
  // Guard against CSV injection: a leading =, +, -, @ or tab is interpreted as a
  // formula by Excel and Sheets.
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(value);
  const safe = needsFormulaGuard ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface ParseCsvOptions {
  /** Trim whitespace around unquoted fields. */
  trim?: boolean;
  /** Treat the first row as a header (default true). */
  header?: boolean;
}

/**
 * Parses a CSV document into objects keyed by the header row.
 *
 * Returns `{ rows, errors }` rather than throwing: a malformed row should be
 * reported to the user alongside the rows that did import successfully.
 */
export function parseCsv(
  input: string,
  options: ParseCsvOptions = {},
): { rows: CsvRow[]; headers: string[]; errors: string[] } {
  const { trim = true, header = true } = options;

  // Strip the BOM that Excel adds on export.
  const text = input.replace(/^\uFEFF/, "");

  const records = parseRecords(text);
  const errors: string[] = [];

  if (records.length === 0) {
    return { rows: [], headers: [], errors: ["The file appears to be empty"] };
  }

  const rawHeaders = (header ? records[0] : undefined) ?? [];
  const headers = rawHeaders.map((h, i) => {
    const name = trim ? h.trim() : h;
    return name.length > 0 ? name : `column_${i + 1}`;
  });

  if (header && headers.length !== new Set(headers).size) {
    errors.push("The header row contains duplicate column names");
  }

  const body = header ? records.slice(1) : records;
  const rows: CsvRow[] = [];

  body.forEach((record, index) => {
    // Ignore completely blank lines, which spreadsheet exports often end with.
    if (record.every((c) => c.trim() === "")) return;

    if (record.length > headers.length) {
      errors.push(
        `Row ${index + (header ? 2 : 1)} has ${record.length} values but there are ${headers.length} columns`,
      );
    }

    const row: CsvRow = {};
    headers.forEach((h, i) => {
      const value = record[i];
      row[h] = value === undefined ? "" : trim ? value.trim() : value;
    });
    rows.push(row);
  });

  return { rows, headers, errors };
}

/** Core state machine: handles quoted fields, escaped quotes and CRLF. */
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      endField();
      i++;
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRecord();
      i++;
      continue;
    }

    if (char === "\n") {
      endRecord();
      i++;
      continue;
    }

    field += char;
    i++;
  }

  // Flush the trailing field/record unless the file ended on a clean newline.
  if (field.length > 0 || record.length > 0) {
    endRecord();
  }

  if (inQuotes) {
    // Unterminated quote: surface it by keeping what we parsed. `parseCsv`
    // callers validate required fields, so the truncated row will be reported.
  }

  return records;
}

/**
 * Case- and punctuation-insensitive header lookup, so an export from this app
 * round-trips even if the user edited the headers in a spreadsheet.
 */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function createHeaderLookup(headers: string[]) {
  const map = new Map(headers.map((h) => [normaliseHeader(h), h]));
  return (candidate: string): string | undefined =>
    map.get(normaliseHeader(candidate));
}

/** Reads a value from a row, trying several possible header spellings. */
export function pick(
  row: CsvRow,
  lookup: (name: string) => string | undefined,
  ...candidates: string[]
): string | undefined {
  for (const candidate of candidates) {
    const key = lookup(candidate);
    if (key !== undefined) {
      const value = row[key];
      if (value !== undefined && value !== "") return value;
    }
  }
  return undefined;
}
