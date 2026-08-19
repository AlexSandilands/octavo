// A search term as a substring ILIKE pattern, with the LIKE metacharacters
// escaped so "100%" finds the row called that, not everything. Shared by every
// DB-side search (members, the issue archive) so escaping can't drift.
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
