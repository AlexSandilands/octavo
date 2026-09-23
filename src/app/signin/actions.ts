"use server";
import * as Sentry from "@sentry/nextjs";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { env } from "@/lib/env";
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

// Reported once per process: with no client address every sign-in shares one
// bucket, 20 per 15 minutes for the whole site.
let reportedNoClientIp = false;

// Request a magic link. Every outcome except a malformed address lands on the
// same "check your email" page: an unknown email throws AccessDenied (the
// signIn callback vetoes it), and revealing that would let anyone probe who
// is a member. Members whose email genuinely failed to send simply retry.
export async function requestMagicLink(formData: FormData) {
  // Where the emailed link lands the member. Same-origin paths only —
  // anything else falls back to the library.
  const next = safeNextPath(formData.get("next"));

  // Per-IP backstop runs before parsing so raw hammering (even with junk
  // emails) is throttled regardless of what was submitted. A null ip is a
  // request that went around Cloudflare; it gets the same answer.
  const ip = clientIp(await headers(), env.ORIGIN_AUTH_SECRET);
  if (
    ip === "unknown" &&
    process.env.NODE_ENV === "production" &&
    !reportedNoClientIp
  ) {
    reportedNoClientIp = true;
    Sentry.captureMessage("Sign-in has no client address (X-Real-IP)", {
      level: "warning",
      tags: { stage: "signin" },
    });
  }
  if (ip === null || !signinByIp.check(ip).ok) {
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
