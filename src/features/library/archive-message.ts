// The one sentence the archive's live region says about the shelf it is
// showing. Plain module (no directive), like the limits beside it: the shelf
// renders it and the dev gate asserts on it, so its wording — the singular
// especially — can only be got right in one place.
export function archiveResultMessage({
  matching,
  query,
  year,
}: {
  /** Issues matching the whole search + filter, not just the served page. */
  matching: number;
  query: string;
  year: number | null;
}): string {
  const issues = matching === 1 ? "issue" : "issues";
  const from = year ? ` from ${year}` : "";

  if (matching === 0) {
    if (query) return `No issues${from} match “${query}”.`;
    return year
      ? `No issues published in ${year}.`
      : "No issues published yet.";
  }
  return query
    ? `${matching} ${issues}${from} ${matching === 1 ? "matches" : "match"} “${query}”.`
    : `Showing ${matching} ${issues}${from}.`;
}
