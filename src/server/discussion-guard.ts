import "server-only";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { getSettings } from "./settings";

// What every discussion write checks besides the session (issue #299): the
// site-wide switch and a per-member budget. Both answer with a sentence rather
// than a throw, so a caller can show it as it stands.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const discussionLimits = {
  post: createRateLimiter({ limit: 10, windowMs: 10 * MINUTE }),
  edit: createRateLimiter({ limit: 30, windowMs: 10 * MINUTE }),
  report: createRateLimiter({ limit: 10, windowMs: HOUR }),
  names: createRateLimiter({ limit: 10, windowMs: HOUR }),
  avatar: createRateLimiter({ limit: 10, windowMs: HOUR }),
} satisfies Record<string, RateLimiter>;

export type Refusal = { ok: false; reason: string };

/** Spends one of the member's requests; a refusal once the budget is gone. */
export function overLimit(
  limiter: RateLimiter,
  userId: string,
): Refusal | null {
  const result = limiter.check(userId);
  if (result.ok) return null;
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return {
    ok: false,
    reason: `You're going a little fast. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  };
}

/** A refusal while discussion is switched off (the shipped default). */
export async function discussionOff(): Promise<Refusal | null> {
  if ((await getSettings()).commentsEnabled) return null;
  return { ok: false, reason: "Discussion is switched off." };
}

// Plain text as stored: CRLF folded to LF, every other control character
// except newline and tab removed, then trimmed.
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "")
    .trim();
}

export const INVALID: Refusal = {
  ok: false,
  reason: "Something about that wasn't right. Please try again.",
};
