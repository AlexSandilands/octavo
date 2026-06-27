// Rich text for body-text blocks. A text block's `text` field holds a small,
// constrained subset of HTML authored in the editor (bold/italic/underline,
// links, bullet/numbered lists, paragraphs) produced by Tiptap. This module is
// framework-agnostic (no client deps) so the readers, the library cover thumb
// and the PDF can all render it server-side.
//
// Two jobs:
//  - `richTextToHtml` turns a stored value into safe HTML for rendering.
//  - Legacy issues stored plain text (with `\n` line breaks); those are escaped
//    and their newlines become <br>, so old content keeps working untouched.

// Tags the renderer keeps; everything else is dropped (inner text is kept).
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Only http(s) and mailto links survive; javascript:, data: and relative hrefs
// are dropped (the anchor stays, the href doesn't).
function safeHref(attrs: string): string | null {
  const m = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  if (!m) return null;
  const href = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  return /^(https?:|mailto:)/i.test(href) ? href : null;
}

// Allowlist sanitiser. Authoring is admin-only and the source is Tiptap (a
// closed tag set), but the column is just a string, so we still sanitise on
// render: drop disallowed tags, strip every attribute except a validated href
// on <a>, and force safe link rels. This neutralises the XSS vectors (script,
// event handlers, javascript: hrefs) regardless of what is in the column.
function sanitizeRichHtml(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");

  return cleaned.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_full, slash: string, name: string, attrs: string) => {
      const tag = name.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (slash) return `</${tag}>`;
      if (tag === "a") {
        const href = safeHref(attrs);
        if (!href) return "<a>";
        return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${tag}>`;
    },
  );
}

// True when the value already carries markup (so it came from the rich editor).
// Legacy plain-text blocks have no tags.
function looksLikeHtml(text: string): boolean {
  return /<(p|br|strong|b|em|i|u|s|ul|ol|li|a)\b|<\/(p|ul|ol|li|a)>/i.test(text);
}

// Render-ready, sanitised HTML for a stored text value. Use with
// `dangerouslySetInnerHTML` in the read-only renderers and to seed the editor.
export function richTextToHtml(text: string): string {
  if (!text) return "";
  if (!looksLikeHtml(text)) {
    return escapeHtml(text).replace(/\r?\n/g, "<br>");
  }
  return sanitizeRichHtml(text);
}
