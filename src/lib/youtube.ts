// Everything the app knows about YouTube links (issue #161). One parser, shared
// by the editor's paste field, the poster-fetch route and the block schema, so
// "is this a YouTube link" has exactly one answer everywhere.
//
// The stored value is the extracted video id, never the pasted URL: an id is a
// bounded, fully-validated token we can build our own URLs from, where a stored
// URL would be an attacker-influenced string every surface would have to
// re-validate before putting it in an `src`. Members paste a link; the boundary
// turns it into an id, and from here on the app only ever composes URLs from a
// hardcoded template.

// A YouTube video id: exactly 11 characters of the URL-safe base64 alphabet.
// This is the one gate — nothing downstream (the embed src, the poster URL, the
// printed link) accepts anything that has not passed it.
export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

// Hosts that serve watch/embed/shorts paths…
const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
// …and the share-link host, whose whole path is the id.
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

// Path forms whose *second* segment is the id: /embed/<id>, /shorts/<id>,
// /live/<id>, /v/<id>. `watch` is handled separately — its id is the `v` query.
const ID_IN_PATH = new Set(["embed", "shorts", "live", "v"]);

/**
 * The video id in a pasted YouTube link, or null if it isn't one.
 *
 * Parsed as a URL rather than matched with a regex, so query junk comes off for
 * free — `&t=90`, `?si=…`, `&list=…` all live in the query string and simply
 * aren't the id. A link with no scheme (`youtu.be/…`, which is what a phone's
 * share sheet often leaves on the clipboard) gets https:// prepended; a bare
 * 11-character id is deliberately NOT accepted, because "that isn't a link" is
 * a message we can give and "that isn't a video" is not.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (SHORT_HOSTS.has(host)) return validId(segments[0]);
  if (!WATCH_HOSTS.has(host)) return null;
  if (segments[0] === "watch") return validId(url.searchParams.get("v"));
  if (segments.length >= 2 && ID_IN_PATH.has(segments[0]!)) {
    return validId(segments[1]);
  }
  return null;
}

function validId(candidate: string | null | undefined): string | null {
  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null;
}

// The privacy-preserving embed host: youtube-nocookie.com sets no tracking
// cookie until the member actually plays something, and the readers only ever
// mount this frame after a deliberate press (see VideoPlayer). `frame-src` in
// the proxy CSP allows this one origin and nothing else.
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// The canonical short link — printed as visible text in the PDF, where nobody
// can press anything, so a reader with the paper copy can type it in.
export function youtubeWatchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

// The same link as it is shown on the page: short enough to read off paper.
export function youtubeWatchLabel(videoId: string): string {
  return `youtu.be/${videoId}`;
}
