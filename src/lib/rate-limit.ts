import "server-only";

// A small in-process fixed-window rate limiter. This app runs as a single
// long-lived Railway node, so an in-memory map is the whole story — no Redis,
// no shared store, no new infrastructure. It is deliberately not correct across
// multiple instances; we don't run any. Each abuse-prone endpoint creates its
// own limiter (its own bucket map) so keys can't collide between endpoints.

export type RateLimitRule = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

export type RateLimiter = {
  /** Records one request for `key` and reports whether it is within budget. */
  check(key: string): RateLimitResult;
};

// Once the map holds more than this many keys, an opportunistic sweep drops
// expired buckets so a stream of unique keys (e.g. many IPs hitting /signin)
// can't grow it without bound.
const SWEEP_THRESHOLD = 10_000;

export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function check(key: string): RateLimitResult {
    const now = Date.now();

    if (buckets.size > SWEEP_THRESHOLD) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + rule.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > rule.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      };
    }
    return { ok: true, remaining: rule.limit - bucket.count };
  }

  return { check };
}
