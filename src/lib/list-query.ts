// What a search box on an admin list means. The members, issues and sponsors
// lists share both halves so "what a query is allowed to be" and "how it is
// matched" can never drift between them.

// The longest search query an admin list accepts. The search box enforces it at
// typing time (maxLength) and every page schema truncates URL-borne queries down
// to it, so an overlong pasted or crafted query still narrows the list instead
// of being silently swapped for "everything". The two ends must agree — a box
// that can produce more than the schema accepts recreates the silent wipe.
export const ADMIN_LIST_QUERY_MAX = 200;

// A search term becomes a substring ILIKE pattern; the LIKE metacharacters are
// escaped so "100%" finds the row called that, not everything.
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
