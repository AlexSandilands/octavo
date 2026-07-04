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

function mac(userId: string): string {
  return base64url(createHmac("sha256", key()).update(userId).digest());
}

// token = base64url(userId) "." base64url(hmac(userId)). The id is encoded so
// the separator can never collide with its contents.
export function signUnsubscribeToken(userId: string): string {
  return `${base64url(Buffer.from(userId, "utf8"))}.${mac(userId)}`;
}

// Returns the user id a token authorises, or null for anything malformed,
// tampered, or signed with the wrong key. Never throws — the route turns null
// into a neutral error page, so a bad token reveals nothing.
export function verifyUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const [encodedId, providedMac] = [
    token.slice(0, dot),
    token.slice(dot + 1),
  ];

  let userId: string;
  try {
    userId = Buffer.from(encodedId, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expectedMac = mac(userId);
  // timingSafeEqual throws on length mismatch, so guard length first — that
  // check leaks nothing an attacker doesn't already control.
  const a = Buffer.from(providedMac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}
