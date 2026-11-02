/**
 * Architecture guards.
 *
 * These are cheap static checks that catch the class of mistake which is easy to
 * make and expensive to discover in production — a secret leaking into the
 * browser bundle, or a repository call that bypasses the session check.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../src");

/** Every `.ts`/`.tsx` file under `src`, excluding generated code. */
function sourceFiles(dir = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "generated" || entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = sourceFiles().map((file) => ({
  file,
  relative: path.relative(SRC, file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

/** Files that start with the client-component directive. */
function isClientComponent(source: string): boolean {
  return /^\s*["']use client["']/.test(source);
}

/** Each `import … from "…";` statement in a module. */
function importStatements(source: string): string[] {
  return source.match(/^import[\s\S]*?from\s+["'][^"']+["'];?/gm) ?? [];
}

/**
 * Returns the body of a function starting at `braceIndex` (the position of its
 * opening `{`), tracking nesting and skipping braces inside strings, template
 * literals and comments.
 */
function extractBody(source: string, braceIndex: number): string {
  let depth = 0;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = braceIndex; i < source.length; i++) {
    const char = source[i]!;
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (char === "\\") {
        i++;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(braceIndex, i);
    }
  }

  return source.slice(braceIndex);
}

describe("architecture", () => {
  it("finds the source tree", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  // The single most damaging mistake in a Next.js app: importing a module that
  // reads secrets into a file that is bundled for the browser.
  it("never imports the environment or the database from a Client Component", () => {
    const forbidden = [
      "@/lib/env",
      "@/lib/db",
      "@/generated/prisma",
      "@/server/repo",
      "@/server/services",
      "@/server/email",
    ];

    const offenders: string[] = [];

    for (const { relative, source } of FILES) {
      if (!isClientComponent(source)) continue;

      for (const specifier of forbidden) {
        // Match the module and anything beneath it.
        if (source.includes(`from "${specifier}"`) || source.includes(`from '${specifier}'`)) {
          offenders.push(`${relative} imports ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("never references process.env secrets in a Client Component", () => {
    const secretPattern =
      /process\.env\.(SESSION_SECRET|DATABASE_URL|SMTP_PASSWORD|SMTP_USER|EMAIL_INBOUND_SECRET|DIRECT_DATABASE_URL)/;

    const offenders = FILES.filter(
      ({ source }) =>
        isClientComponent(source) && secretPattern.test(source),
    ).map(({ relative }) => relative);

    expect(offenders).toEqual([]);
  });

  // `'use server'` files may only export async functions at runtime. Type-only
  // exports are erased by the compiler and are allowed.
  it("only exports async values from 'use server' modules", () => {
    const offenders: string[] = [];

    for (const { relative, source } of FILES) {
      if (!/^\s*["']use server["']/.test(source)) continue;

      // `export const/let/var/function/class/enum` that is not async, ignoring
      // `interface` and `type` (erased at build time).
      const bad = source.match(
        /^export\s+(?:const|let|var|function|class|enum)\b(?!(?:\s+async))(?![^\n]*\binterface\b)/gm,
      );
      if (bad) offenders.push(`${relative}: ${bad.join(", ")}`);
    }

    expect(offenders).toEqual([]);
  });

  // The tenancy contract: any exported repository function that touches the
  // database must take `userId` and use it. Checking the function *body*
  // avoids false positives on pure helpers such as `normalisePaging`.
  it("scopes every database call in a repository to a userId parameter", () => {
    const offenders: string[] = [];

    for (const { relative, source } of FILES) {
      if (!relative.startsWith("server/repo/")) continue;

      const signature =
        /^export\s+(?:async\s+)?function\s+(\w+)\s*\(([\s\S]*?)\)\s*(?::[\s\S]*?)?\{/gm;

      for (const match of source.matchAll(signature)) {
        const [, name, params] = match;
        const body = extractBody(source, match.index! + match[0].length - 1);

        const touchesDatabase = /\bdb\.\w+\s*\(/.test(body);
        if (!touchesDatabase) continue;

        if (!params?.includes("userId")) {
          offenders.push(`${relative}: ${name}() queries the database without userId`);
          continue;
        }

        // And the parameter must actually be used to scope the query, not merely
        // accepted and ignored.
        if (!/\buserId\b[\s\S]*?(where|userId\s*:)/.test(body)) {
          offenders.push(`${relative}: ${name}() accepts userId but never scopes by it`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("does not import the Prisma runtime from app routes", () => {
    const offenders: string[] = [];

    for (const { relative, source } of FILES) {
      if (!relative.startsWith("app/")) continue;

      for (const statement of importStatements(source)) {
        // `import type …` is erased by the compiler and cannot pull the Prisma
        // runtime into the bundle, so it is fine.
        const isTypeOnly = /^import\s+type\b/.test(statement);
        if (isTypeOnly) continue;
        if (statement.includes("@/generated/prisma")) {
          offenders.push(relative);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("has a database migration for the initial schema", () => {
    const migrations = path.resolve(__dirname, "../../prisma/migrations");
    const entries = readdirSync(migrations).filter((e) =>
      statSync(path.join(migrations, e)).isDirectory(),
    );
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(
      readdirSync(path.join(migrations, entries[0]!)).includes("migration.sql"),
    ).toBe(true);
  });
});
