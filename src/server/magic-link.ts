import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/next-path";

// A personal sign-in link minted outside Auth.js — the publish blast's "Read
// issue" button and the reply email's "Read the reply" (issue #303).
//
// Security: the link is a single-use sign-in credential and MUST be produced
// by the exact mechanism Auth.js uses for the sign-in email, or the callback
// route won't accept it. Auth.js's email flow (see
// @auth/core/lib/actions/signin/send-token.js) is:
//   1. token   = randomString(32)                     — the raw value in the URL
//   2. stored  = sha256hex(`${token}${secret}`)       — what lands in the DB
//   3. url     = `${origin}/api/auth/callback/resend?callbackUrl=…&token=<raw>&email=<id>`
// On click, the callback recomputes sha256hex(`${rawToken}${secret}`) and calls
// the adapter's useVerificationToken, which deletes the row as it reads it —
// that delete-on-read is what makes the link single-use. We replicate exactly
// that here, with the SAME secret the callback uses (`provider.secret ??
// options.secret`, which for our config is env.AUTH_SECRET — see auth.ts), so
// our links are indistinguishable from ones Auth.js minted.
//
// Coupling note: if the deployment ever moves to AUTH_SECRET rotation (an
// array of secrets), revisit this — the callback would hash against the array
// and these links would need to match.

// Match the Resend provider's maxAge (24h) so an emailed link is no
// longer-lived than a sign-in link. If it lapses before a member opens it,
// they aren't stuck: the sign-in page says it expired and keeps the
// destination, so a fresh link lands them in the same place.
export const MAGIC_LINK_MAX_AGE_SECONDS = 24 * 60 * 60;

export type MagicLink = {
  /** The verification_tokens row to insert (hashed token) before sending. */
  tokenRow: { identifier: string; token: string; expires: Date };
  /** The link itself, carrying the raw token. */
  url: string;
};

// Auth.js's createHash is web-crypto SHA-256 hex; node's createHash produces
// the identical digest for the same input.
function hashVerificationToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${rawToken}${env.AUTH_SECRET}`)
    .digest("hex");
}

/** One member's link to `path` on `origin`. The caller inserts `tokenRow`
 *  (in bulk for a blast) before the email goes out. */
export function mintMagicLink(
  email: string,
  path: string,
  origin: string,
): MagicLink {
  const rawToken = randomBytes(32).toString("hex");
  // Where the link lands after sign-in, run through the same same-origin guard
  // the sign-in ?next uses — belt-and-braces against an off-site callbackUrl.
  const params = new URLSearchParams({
    callbackUrl: safeNextPath(path),
    token: rawToken,
    email,
  });
  return {
    tokenRow: {
      identifier: email,
      token: hashVerificationToken(rawToken),
      expires: new Date(Date.now() + MAGIC_LINK_MAX_AGE_SECONDS * 1000),
    },
    url: `${origin}/api/auth/callback/resend?${params}`,
  };
}
