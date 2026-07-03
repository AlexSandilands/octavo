// A small, dependency-free CSV parser for the one shape this app imports: a
// members list with an email column and an optional name column. It is
// deliberately forgiving of the messes a non-technical admin's spreadsheet
// export produces — a UTF-8 BOM, CRLF line endings, quoted fields with commas
// or embedded quotes, trailing blank lines, and a header row in any column
// order (or no header at all). Anything it can't make a valid email out of is
// counted and skipped, never thrown.

export type ParsedMember = { email: string; name: string | null };

export type ParseResult = {
  // Valid, de-duplicated rows ready to send to the import action.
  members: ParsedMember[];
  // Rows whose email column was missing or not a valid address.
  invalid: number;
  // Valid rows whose email repeated one already seen earlier in the file.
  duplicates: number;
};

// Intentionally simple: good enough to reject obvious junk client-side. The
// server re-validates every address with zod before it touches the database.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parse one CSV line into fields, honouring double-quoted fields (in which "" is
// a literal quote and commas are data, not separators).
function splitRow(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

// Decide which column holds the email and which the name. If the first row
// names them ("email"/"e-mail"/"mail", "name"/"full name"), trust that;
// otherwise fall back to: email is whichever column looks like an address,
// name is the other one, and the first row is treated as data (no header).
function resolveColumns(firstRow: string[]): {
  emailIdx: number;
  nameIdx: number;
  hasHeader: boolean;
} {
  const lower = firstRow.map((c) => c.toLowerCase());
  const emailHeader = lower.findIndex((c) =>
    ["email", "e-mail", "mail", "email address"].includes(c),
  );
  const nameHeader = lower.findIndex((c) =>
    ["name", "full name", "member", "member name"].includes(c),
  );
  if (emailHeader !== -1) {
    return {
      emailIdx: emailHeader,
      nameIdx: nameHeader,
      hasHeader: true,
    };
  }
  // No recognisable header — infer by content. The email column is the first
  // field that parses as an address; the name is the first non-email field.
  const emailIdx = firstRow.findIndex((c) => EMAIL_RE.test(c));
  const nameIdx = firstRow.findIndex((c, i) => i !== emailIdx && c.length > 0);
  return {
    emailIdx: emailIdx === -1 ? 0 : emailIdx,
    nameIdx,
    hasHeader: false,
  };
}

export function parseMembersCsv(input: string): ParseResult {
  // Strip a UTF-8 BOM, then split on CRLF/CR/LF and drop blank lines.
  const text = input.replace(/^﻿/, "");
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { members: [], invalid: 0, duplicates: 0 };

  const firstFields = splitRow(lines[0]!);
  const { emailIdx, nameIdx, hasHeader } = resolveColumns(firstFields);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const members: ParsedMember[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicates = 0;

  for (const line of dataLines) {
    const fields = splitRow(line);
    const email = (fields[emailIdx] ?? "").toLowerCase();
    if (!EMAIL_RE.test(email)) {
      invalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    const rawName = nameIdx === -1 ? "" : (fields[nameIdx] ?? "");
    members.push({ email, name: rawName.length > 0 ? rawName : null });
  }

  return { members, invalid, duplicates };
}
