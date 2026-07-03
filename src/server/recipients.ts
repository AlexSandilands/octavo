import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

// Data access for the mailing list — the subset of the users table the publish
// blast and the unsubscribe flow need. Kept separate from members admin CRUD so
// the two features don't share a module (and don't collide in review).

export type Recipient = { id: string; email: string; name: string | null };

export type RecipientState = Recipient & { subscribed: boolean };

// Everyone who should receive a new-issue email. Admins are members too, so
// they get the blast if subscribed — deliberate: the admin seeing their own
// copy is the cheapest end-to-end delivery check there is.
export async function listSubscribedRecipients(): Promise<Recipient[]> {
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.subscribed, true));
}

export async function countSubscribedRecipients(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.subscribed, true));
  return row?.n ?? 0;
}

// Used by the unsubscribe page: it greets the token's owner by address and
// branches on whether they're currently subscribed.
export async function getRecipientById(
  id: string,
): Promise<RecipientState | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscribed: users.subscribed,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

// The one write the unsubscribe flow makes. Idempotent by nature — setting the
// flag to the value it already holds is a no-op — which is what lets the
// confirm/resubscribe buttons be safe to click twice.
export async function setSubscribed(
  id: string,
  subscribed: boolean,
): Promise<void> {
  await db.update(users).set({ subscribed }).where(eq(users.id, id));
}
