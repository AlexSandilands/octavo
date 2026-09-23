import { setEmailsFor } from "@/server/recipients";
import { verifyUnsubscribeToken } from "@/server/unsubscribe-token";

// RFC 8058 one-click unsubscribe endpoint. Mailbox providers (Gmail/Yahoo)
// POST here — with body `List-Unsubscribe=One-Click` — when a member taps the
// native "Unsubscribe" affordance the List-Unsubscribe headers put in the
// client (see src/server/publish-email.ts). No session: the signed token in
// ?token= IS the authorisation (see src/server/unsubscribe-token.ts), and it
// binds a single user id under an HMAC only the server can produce, so the
// POST body is never consulted.
//
// The token's purpose (issue #303) picks the emails: an issues token (every
// pre-#303 one included) stops new-issue emails, a replies token stops reply
// emails, and neither touches the other flag.
//
// This endpoint ONLY ever unsubscribes — it can never resubscribe or toggle,
// so a provider's automated POST can only ever stop mail (the safe direction).
// The interactive /unsubscribe page keeps the two-way confirm/resubscribe UI.
//
// POST-only by design: prefetchers, link scanners and antivirus proxies issue
// GETs, and a GET must never mutate. There is no GET export, so Next answers a
// GET with 405 Method Not Allowed on its own.

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");

  // verifyUnsubscribeToken returns null (never throws) for a missing,
  // malformed, tampered, or wrong-key token — branch on that and change
  // nothing.
  const grant = verifyUnsubscribeToken(token);
  if (!grant) {
    return new Response(null, { status: 400 });
  }

  // Idempotent: clearing a flag that is already off is a no-op, so a provider
  // retrying the POST is harmless.
  await setEmailsFor(grant, false);
  return new Response(null, { status: 200 });
}
