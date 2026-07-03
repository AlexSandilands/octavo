"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setSubscribed } from "@/server/recipients";
import { verifyUnsubscribeToken } from "@/server/unsubscribe-token";

// The one mutation the unsubscribe flow makes. It only ever runs from a POSTed
// form (the confirm / resubscribe button), so an email scanner that GET-prefetches
// the link can't trip it. The token is re-verified here — the id to update comes
// out of the signed token, never from a hidden field a caller could swap.
const schema = z.object({
  token: z.string(),
  subscribe: z.enum(["true", "false"]),
});

export async function updateSubscriptionAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    subscribe: formData.get("subscribe"),
  });
  // A malformed submission drops to the neutral invalid-link page (no token),
  // revealing nothing.
  if (!parsed.success) redirect("/unsubscribe");

  const userId = verifyUnsubscribeToken(parsed.data.token);
  if (!userId) redirect("/unsubscribe");

  await setSubscribed(userId, parsed.data.subscribe === "true");

  // Back to the same link: the page re-reads the flag from the DB and shows the
  // resulting state (unsubscribed → offer resubscribe, and vice versa).
  redirect(`/unsubscribe?token=${encodeURIComponent(parsed.data.token)}`);
}
