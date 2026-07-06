"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setSubscribed } from "@/server/recipients";
import { requireMemberOrRedirect } from "@/server/session";

// The member-facing counterpart of the token-gated unsubscribe action. Here the
// session IS the authorisation: the id to update is derived from the live
// session inside the action, never from a hidden form field a caller could
// swap. A signed-out POST is redirected to /signin by the gate before any write
// runs; a demo-mode visitor (no session) drops out with nothing mutated.
const schema = z.object({ subscribe: z.enum(["true", "false"]) });

export async function updateEmailPreferenceAction(formData: FormData) {
  const user = await requireMemberOrRedirect("/preferences");
  if (!user) return; // demo mode: no member, nothing to change.

  const parsed = schema.safeParse({ subscribe: formData.get("subscribe") });
  if (!parsed.success) return; // malformed submit: no-op, page re-reads state.

  // Idempotent by nature (setSubscribed is a plain flag write), so a
  // double-submit is harmless.
  await setSubscribed(user.id, parsed.data.subscribe === "true");

  // Re-render the page so the toggle reflects the flag we just wrote.
  revalidatePath("/preferences");
}
