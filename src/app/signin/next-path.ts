// The post-sign-in return path (?next=). Only same-origin paths pass:
// absolute URLs, protocol-relative //host, and backslash tricks all fall back
// to the library — an open redirect in a magic-link flow would let a phishing
// email borrow our domain's trust.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/";
  return value;
}
