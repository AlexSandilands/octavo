// The longest search query the members list accepts. The search box enforces
// it at typing time (maxLength) and the page schema truncates URL-borne
// queries down to it, so an overlong pasted or crafted query still narrows the
// list instead of being silently swapped for "everyone". The two ends must
// agree — a box that can produce more than the schema accepts recreates the
// silent wipe. Plain module (no directive): imported by both the server page
// and the client search box.
export const MEMBERS_QUERY_MAX = 200;
