"use server";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/next-path";
import { createRateLimiter } from "@/lib/rate-limit";
import { signIn, signOut } from "@/server/auth";

const emailSchema = z.string().trim().toLowerCase().email();

// This endpoint sends email, so throttle it. Two limiters, both fail-safe for
// the neutral-response contract (they fire the same way for members and
// non-members, so they leak nothing about who is on the list):
//   - per IP+email: caps mailbombing a single member,
//   - per IP: a looser backstop on total send volume from one source that
//     still leaves ample headroom for a club behind a shared/NAT'd IP.
const signinByEmail = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const signinByIp = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });

// Client IP for rate-limit keys. The first hop of X-Forwarded-For is
// client-supplied (proxies append, so anything the client sent rides in
// front) — keying on it would let an attacker rotate fake IPs past the
// limiter. Prefer CF-Connecting-IP (set by Cloudflare, which fronts
// production), then the LAST forwarded hop (written by the proxy nearest
// us), then X-Real-IP, then a shared bucket.
function clientIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const last = hops[hops.length - 1]!.trim();
    if (last) return last;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

// Request a magic link. Every outcome except a malformed address lands on the
// same "check your email" page: an unknown email throws AccessDenied (the
// signIn callback vetoes it), and revealing that would let anyone probe who
// is a member. Members whose email genuinely failed to send simply retry.
export async function requestMagicLink(formData: FormData) {
  // Where the emailed link lands the member. Same-origin paths only —
  // anything else falls back to the library.
  const next = safeNextPath(formData.get("next"));

  // Per-IP backstop runs before parsing so raw hammering (even with junk
  // emails) is throttled regardless of what was submitted.
  const ip = clientIp(await headers());
  if (!signinByIp.check(ip).ok) {
    redirect(`/signin?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect(`/signin?error=invalid-email&next=${encodeURIComponent(next)}`);
  }

  if (!signinByEmail.check(`${ip}:${parsed.data}`).ok) {
    redirect(`/signin?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  try {
    // redirectTo pins the destination; the default would bounce the member
    // back to this form via the Referer.
    await signIn("resend", {
      email: parsed.data,
      redirect: false,
      redirectTo: next,
    });
  } catch (err) {
    // AccessDenied is the expected non-member veto — stay silent. Anything
    // else (Resend outage, DB failure) still shows the neutral page, but the
    // operator needs the log line or members are locked out invisibly.
    if (!(err instanceof AuthError && err.type === "AccessDenied")) {
      console.error("[auth] sign-in request failed:", err);
    }
  }
  redirect("/signin/sent");
}

// Deletes the session row and clears the cookie for this device only.
export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
