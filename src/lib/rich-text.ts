// Shared URL/text helpers for rich text. As of content v3 body text is stored
// as structured JSON and rendered through React elements (see rich-text-doc.ts +
// features/blocks/rich-text.tsx), so there is no HTML sanitiser here any more —
// escaping is React's job and `externalHref` is the single source of truth for
// what counts as a safe outbound link. Kept framework-agnostic (no client deps)
// so readers, editor, PDF and the email templates can all share it.

// Exported as the app's one attribute-safe HTML escaper (the magic-link and
// new-issue email templates build raw HTML strings and use it on interpolated
// values).
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Normalise a user-entered value into a safe external href, or null if it can't
// be one. http(s)/mailto pass through; a scheme-less host (example.com,
// www.x.org, //x.org) is assumed https — so authors don't have to type the
// protocol — while any other scheme (javascript:, data:, tel:…) and bare
// relative paths are rejected. Shared by the sponsor block, the editor's link
// tool, the rich-text renderer and the doc schema so they all agree on what
// counts as a link.
export function externalHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // some other scheme — drop it
  if (v.startsWith("//")) return `https:${v}`;
  // Looks like a hostname (has a dot, no spaces) → assume https.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(v)) return `https://${v}`;
  return null;
}
