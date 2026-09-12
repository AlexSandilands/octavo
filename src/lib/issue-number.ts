// Postgres `integer` is signed 32-bit. Keep the UI and server boundary inside
// the actual storage range so an oversized value is reported as input, not as
// a database failure.
export const ISSUE_NUMBER_MAX = 2_147_483_647;

/** The reader-facing number. Legacy rows have no explicit display number and
 * continue to show their immutable route identity. */
export function displayedIssueNumber(issue: {
  number: number;
  displayNumber: number | null;
}): number {
  return issue.displayNumber ?? issue.number;
}
