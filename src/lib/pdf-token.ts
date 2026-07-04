import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// The internal token that authorises a request to the print route
// (`/read/[n]/print`). PDF generation is a localhost self-fetch: the generator
// (src/lib/pdf.ts) passes this token, the print page verifies it. Because the
// reader is members-only, the print route must not be publicly reachable — the
// token is what keeps it internal (the edge auth gate lets `/print` through so
// the cookie-less generator can reach it, so this is the only guard on the
// route; see src/middleware.ts).
//
// It is a static value derived from AUTH_SECRET, not a per-request nonce: the
// print route only ever renders already-published issue content (which members
// can read anyway), so replay is harmless — the token exists to stop the route
// being crawled/DoS'd from outside, not to protect a secret. Derived from
// AUTH_SECRET so it needs no extra config and can never reach the browser
// (AUTH_SECRET is server-only). Kept out of pdf.ts so the print route can
// import it without pulling Playwright into the page.

let cached: string | null = null;

export function printToken(): string {
  if (cached) return cached;
  cached = createHash("sha256")
    .update(`${env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  return cached;
}

// Constant-time comparison so a wrong token can't be teased apart byte by byte.
export function verifyPrintToken(
  candidate: string | undefined | null,
): boolean {
  if (!candidate) return false;
  const expected = Buffer.from(printToken());
  const got = Buffer.from(candidate);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
