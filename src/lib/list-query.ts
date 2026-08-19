// The longest search query an admin list accepts. The search box enforces it at
// typing time (maxLength) and every page schema truncates URL-borne queries down
// to it, so an overlong pasted or crafted query still narrows the list instead
// of being silently swapped for "everything". The two ends must agree — a box
// that can produce more than the schema accepts recreates the silent wipe.
// Shared by the members, issues and sponsors lists.
export const ADMIN_LIST_QUERY_MAX = 200;
