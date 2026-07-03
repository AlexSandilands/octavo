// The post-sign-in return path (?next=). Only same-origin paths pass:
// absolute URLs, protocol-relative //host, and backslash tricks all fall back
// to the library — an open redirect in a magic-link flow would let a phishing
// email borrow our domain's trust. (Auth.js's own redirect callback is the
// primary guard; this is defense-in-depth in front of it.) Control characters
// are rejected too, so a CR/LF can't ride the value into a Location header.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\x00-\x1f]/.test(value)) return "/";
  return value;
}
