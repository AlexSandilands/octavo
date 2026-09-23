import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Signed, unauthenticated unsubscribe tokens.
//
// The unsubscribe link arrives in an email and must work with no session, so
// the token IS the authorisation: it binds a single user id under an HMAC that
// only the server can produce. A token minted for user A can never be replayed
// as user B (the id is inside the signed payload), and a flipped character
// fails the constant-time check.
//
// Purpose (issue #303): a token names which emails it stops — `issues` (new
// issues, `users.subscribed`) or `replies` (reply emails, `users.reply_emails`)
// — and the purpose is part of the signed payload, `<purpose>:<userId>`, so a
// replies token can't be relabelled as an issues one or the other way round.
// A token with no purpose (a bare user id: every link sent before #303) still
// verifies exactly as it always did and means `issues`. User ids are UUIDs, so
// a bare id never starts with a purpose and a colon.
//
// Key separation: we don't sign with AUTH_SECRET directly. A derived key keeps
// the unsubscribe domain independent from Auth.js's own token hashing, so one
// scheme can never be used to forge the other.
//
// Expiry: none, deliberately. Unsubscribe links traditionally live for the
// life of the email — a member may act on an old issue's footer months later,
// and an expired unsubscribe link that silently fails is exactly the footgun
// anti-spam rules exist to prevent. The token is low-sensitivity (its only
// power is to stop mail to its own owner) and the action is a confirmed,
// idempotent toggle, so a long life is the right trade.

export const UNSUBSCRIBE_PURPOSES = ["issues", "replies"] as const;
export type UnsubscribePurpose = (typeof UNSUBSCRIBE_PURPOSES)[number];

export type UnsubscribeGrant = { userId: string; purpose: UnsubscribePurpose };

const KEY_INFO = "octavo/unsubscribe/v1";

// One derived signing key per process, computed lazily from AUTH_SECRET.
let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) {
    cachedKey = createHmac("sha256", env.AUTH_SECRET).update(KEY_INFO).digest();
  }
  return cachedKey;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function mac(payload: string): string {
  return base64url(createHmac("sha256", key()).update(payload).digest());
}

// token = base64url(payload) "." base64url(hmac(payload)), payload =
// `<purpose>:<userId>`. Encoded so the separator can never collide with it.
export function signUnsubscribeToken(
  userId: string,
  purpose: UnsubscribePurpose,
): string {
  const payload = `${purpose}:${userId}`;
  return `${base64url(Buffer.from(payload, "utf8"))}.${mac(payload)}`;
}

// A verified payload, read: `<purpose>:<id>`, or a bare id (a pre-#303 token).
function grantOf(payload: string): UnsubscribeGrant | null {
  const colon = payload.indexOf(":");
  const prefix = colon > 0 ? payload.slice(0, colon) : null;
  const purpose = UNSUBSCRIBE_PURPOSES.find((p) => p === prefix);
  if (!purpose) return { userId: payload, purpose: "issues" };
  const userId = payload.slice(colon + 1);
  return userId ? { userId, purpose } : null;
}

// Returns the user and purpose a token authorises, or null for anything
// malformed, tampered, or signed with the wrong key. Never throws — the route
// turns null into a neutral error page, so a bad token reveals nothing.
export function verifyUnsubscribeToken(
  token: unknown,
): UnsubscribeGrant | null {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const [encoded, providedMac] = [token.slice(0, dot), token.slice(dot + 1)];

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!payload) return null;

  const expectedMac = mac(payload);
  // timingSafeEqual throws on length mismatch, so guard length first — that
  // check leaks nothing an attacker doesn't already control.
  const a = Buffer.from(providedMac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return grantOf(payload);
}
