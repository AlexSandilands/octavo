// The one definition of "an address this app will accept as a member". Both
// ends of the CSV import judge a row with it: the browser's preview counts a
// row valid only if this says so, and the server's zod schemas accept only what
// this matches — so a row the preview promises to import is never the row that
// makes the import fail (#124).
//
// The pattern is zod 3's own `.email()` regex, kept here rather than reached
// for through zod so the strict check can run in the browser without pulling
// zod into the client bundle. `scripts/check-parse-members-csv.mts` asserts the
// two still agree, so a zod upgrade that moves the goalposts trips a gate
// instead of quietly splitting the ends apart again.
export const MEMBER_EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

// The longest address we store — the members schemas' bound, applied here too
// so both ends draw the line in the same place.
export const MEMBER_EMAIL_MAX = 200;

// Canonical form of an address as it is stored and matched: trimmed and
// lower-cased, so "  Alex@Example.COM " and "alex@example.com" are one member,
// matching the unique index and future sign-ins.
export function normaliseMemberEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Would this address survive the server's validation? Answered without zod, so
// a client can ask it of every row of a large file.
export function isMemberEmail(value: string): boolean {
  const email = normaliseMemberEmail(value);
  return email.length <= MEMBER_EMAIL_MAX && MEMBER_EMAIL_RE.test(email);
}
