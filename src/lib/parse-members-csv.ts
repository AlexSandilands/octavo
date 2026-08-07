// A small, dependency-free CSV parser for the one shape this app imports: a
// members list with an email column and an optional name column. It is
// deliberately forgiving of the messes a non-technical admin's spreadsheet
// export produces — a UTF-8 BOM, CRLF line endings, quoted fields with commas
// or embedded quotes, trailing blank lines, comma/semicolon/tab separators, a
// header row in any column order (or no header at all), and names split across
// "First Name"/"Last Name" columns. Anything it can't make a valid email out of
// is counted and skipped, never thrown.

import { isMemberEmail, normaliseMemberEmail } from "./member-email";

export type ParsedMember = { email: string; name: string | null };

export type ParseResult = {
  // Valid, de-duplicated rows ready to send to the import action.
  members: ParsedMember[];
  // Rows whose email column was missing or not a valid address.
  invalid: number;
  // Valid rows whose email repeated one already seen earlier in the file.
  duplicates: number;
};

// Separators a spreadsheet export might use, in preference order: the comma,
// the semicolon a European Excel writes, and the tab of a pasted sheet.
const DELIMITERS = [",", ";", "\t"] as const;

// Accepted header spellings, in normalised form (see `normaliseHeader`):
// lower case, with underscores and hyphens read as spaces, so `First_Name`,
// `first-name` and `First Name` are all the same header. Keep these in step
// with the list the help guide shows admins (features/help/section-members).
const EMAIL_HEADERS = [
  "email",
  "e mail",
  "mail",
  "email address",
  "e mail address",
];
const FULL_NAME_HEADERS = [
  "name",
  "full name",
  "member",
  "member name",
  "display name",
  "contact name",
];
const FIRST_NAME_HEADERS = ["first name", "given name", "forename", "first"];
const LAST_NAME_HEADERS = ["last name", "surname", "family name", "last"];

// Parse one CSV line into fields, honouring double-quoted fields (in which "" is
// a literal quote and the delimiter is data, not a separator).
function splitRow(line: string, delimiter: string): string[] {
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
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

function normaliseHeader(cell: string): string {
  return cell.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// The same test the server applies before writing a row, so a row this parser
// hands to the preview as valid is one the import can actually use — and a row
// it drops is one the import would have dropped anyway (#124). It decides both
// what counts as a member and, through `rowHasEmail`, which column is which.
function isEmail(field: string): boolean {
  return isMemberEmail(field);
}

function rowHasEmail(row: string[] | undefined): boolean {
  return row?.some(isEmail) ?? false;
}

function findHeader(header: string[], accepted: readonly string[]): number {
  return header.findIndex((c) => accepted.includes(normaliseHeader(c)));
}

function namesAColumn(row: string[]): boolean {
  return (
    findHeader(row, EMAIL_HEADERS) !== -1 ||
    findHeader(row, FULL_NAME_HEADERS) !== -1 ||
    findHeader(row, FIRST_NAME_HEADERS) !== -1 ||
    findHeader(row, LAST_NAME_HEADERS) !== -1
  );
}

// How far into the file to look for the row that names the columns: usually the
// first, but a spreadsheet export can put a title line above it.
const HEADER_SEARCH_ROWS = 5;

// Which separator was this file written with? Split the file each way and keep
// the reading that finds the most addresses — a semicolon file split on commas
// leaves `Ada;ada@example.com` in one field, which is not an address. Ties (a
// one-column file, or names with no spaces in them) fall to whichever reading
// names an email column, then to whichever found more columns, then to the
// comma.
function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 20);
  let best: string = DELIMITERS[0];
  let bestScore: [number, number, number] = [-1, -1, -1];
  for (const delimiter of DELIMITERS) {
    const rows = sample.map((l) => splitRow(l, delimiter));
    const score: [number, number, number] = [
      rows.filter(rowHasEmail).length,
      rows.slice(0, HEADER_SEARCH_ROWS).some(namesAColumn) ? 1 : 0,
      Math.max(...rows.map((r) => r.length)),
    ];
    if (
      score[0] > bestScore[0] ||
      (score[0] === bestScore[0] &&
        (score[1] > bestScore[1] ||
          (score[1] === bestScore[1] && score[2] > bestScore[2])))
    ) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

type Columns = {
  emailIdx: number;
  // -1 when the file has no such column. A name comes from `fullNameIdx` when
  // that column holds something, otherwise from first + last joined.
  fullNameIdx: number;
  firstNameIdx: number;
  lastNameIdx: number;
  // Row that names the columns, -1 when the file has no header at all. Rows
  // above it (a spreadsheet's title line) are skipped as unusable.
  headerIdx: number;
};

// Which row names the columns? Look a few rows in, stopping at the first row
// that holds an address — that is data, and means the header is behind us.
function headerRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    if (rowHasEmail(row)) break;
    if (namesAColumn(row)) return i;
  }
  // No row names its columns in a spelling we know. The first row is still a
  // header if it holds no address while a later row does — reading it as data
  // would silently eat it (and shift the whole file).
  return !rowHasEmail(rows[0]) && rows.slice(1).some(rowHasEmail) ? 0 : -1;
}

// Decide which columns hold the email and the name(s). A header row that names
// the email column is authoritative. Otherwise the columns are inferred from
// the first row that actually contains an address — never from the header row,
// which by definition holds none.
function resolveColumns(rows: string[][]): Columns {
  const headerIdx = headerRowIndex(rows);
  const header = headerIdx === -1 ? [] : (rows[headerIdx] ?? []);
  const emailHeader = findHeader(header, EMAIL_HEADERS);
  const fullNameIdx = findHeader(header, FULL_NAME_HEADERS);
  const firstNameIdx = findHeader(header, FIRST_NAME_HEADERS);
  const lastNameIdx = findHeader(header, LAST_NAME_HEADERS);
  const named = fullNameIdx !== -1 || firstNameIdx !== -1 || lastNameIdx !== -1;

  if (emailHeader !== -1) {
    return {
      emailIdx: emailHeader,
      fullNameIdx,
      firstNameIdx,
      lastNameIdx,
      headerIdx,
    };
  }

  const dataRow = rows.slice(headerIdx + 1).find(rowHasEmail) ?? [];
  const emailIdx = dataRow.findIndex(isEmail);
  // Only guess at a name column when the header said nothing about names: a
  // recognised header is authoritative, and a column it didn't name (a phone
  // number, a joining date) is not a name.
  const guessedName = named
    ? -1
    : dataRow.findIndex((c, i) => i !== emailIdx && c.length > 0);

  return {
    emailIdx: emailIdx === -1 ? 0 : emailIdx,
    fullNameIdx: named ? fullNameIdx : guessedName,
    firstNameIdx: named ? firstNameIdx : -1,
    lastNameIdx: named ? lastNameIdx : -1,
    headerIdx,
  };
}

function rowName(fields: string[], cols: Columns): string | null {
  const at = (idx: number) => (idx === -1 ? "" : (fields[idx] ?? "").trim());
  const full = at(cols.fullNameIdx);
  if (full.length > 0) return full;
  const joined = [at(cols.firstNameIdx), at(cols.lastNameIdx)]
    .filter((part) => part.length > 0)
    .join(" ");
  return joined.length > 0 ? joined : null;
}

export function parseMembersCsv(input: string): ParseResult {
  // Strip a UTF-8 BOM, then split on CRLF/CR/LF and drop blank lines.
  const text = input.replace(/^﻿/, "");
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { members: [], invalid: 0, duplicates: 0 };

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((l) => splitRow(l, delimiter));
  const cols = resolveColumns(rows);
  const dataRows = rows.slice(cols.headerIdx + 1);

  const members: ParsedMember[] = [];
  const seen = new Set<string>();
  // Anything above the header row is a title line or a stray note: unusable,
  // and counted so the preview never hides a row it dropped.
  let invalid = Math.max(cols.headerIdx, 0);
  let duplicates = 0;

  for (const fields of dataRows) {
    const email = normaliseMemberEmail(fields[cols.emailIdx] ?? "");
    if (!isEmail(email)) {
      invalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    members.push({ email, name: rowName(fields, cols) });
  }

  return { members, invalid, duplicates };
}
