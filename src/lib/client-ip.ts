import { createHash, timingSafeEqual } from "node:crypto";

// The client address the sign-in rate limits key on.
//
// Cloudflare fronts production and sets CF-Connecting-IP, but Railway's edge
// also answers requests sent to it directly, which can carry any header. So
// with ORIGIN_AUTH_SECRET set (a Cloudflare Transform Rule adds it as
// X-Origin-Auth), CF-Connecting-IP counts only beside that secret, and a
// request without it skipped Cloudflare: null, which the caller refuses.
//
// Otherwise (the demo, local dev) it is X-Real-IP, which Railway's edge sets.
// X-Forwarded-For is never read: Railway documents nothing about it, and its
// last hop varies from one request to the next there.
export function clientIp(
  h: Headers,
  originSecret: string | undefined,
): string | null {
  const realIp = h.get("x-real-ip")?.trim() || "unknown";
  if (!originSecret) return realIp;
  if (!sameSecret(h.get("x-origin-auth") ?? "", originSecret)) return null;
  return h.get("cf-connecting-ip")?.trim() || realIp;
}

// Hashed first so the constant-time compare never sees unequal lengths.
function sameSecret(sent: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(sent), digest(expected));
}
