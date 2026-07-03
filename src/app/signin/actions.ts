"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/server/auth";
import { safeNextPath } from "./next-path";

const emailSchema = z.string().trim().toLowerCase().email();

// Request a magic link. Every outcome except a malformed address lands on the
// same "check your email" page: an unknown email throws AccessDenied (the
// signIn callback vetoes it), and revealing that would let anyone probe who
// is a member. Members whose email genuinely failed to send simply retry.
export async function requestMagicLink(formData: FormData) {
  // Where the emailed link lands the member. Same-origin paths only —
  // anything else falls back to the library.
  const next = safeNextPath(formData.get("next"));
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect(`/signin?error=invalid-email&next=${encodeURIComponent(next)}`);
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
