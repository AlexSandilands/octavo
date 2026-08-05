import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

// Server-only data access for the club member list (the `users` table). All
// callers (server components, server actions) go through here — never query
// Drizzle from a component. Membership = presence on this list; removing a row
// revokes a person's ability to sign in.

// The columns the members UI needs — never `select()` the whole row, so the
// bearer session token and email-verification timestamp stay server-side.
const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  isAdmin: users.isAdmin,
  subscribed: users.subscribed,
  createdAt: users.createdAt,
} as const;

export type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  subscribed: boolean;
  createdAt: Date;
};

// Newest first so a just-added member (and a fresh import) surfaces at the top;
// email as a stable tiebreaker for the many near-simultaneous CSV rows.
export async function listUsers(): Promise<MemberRow[]> {
  return db
    .select(memberColumns)
    .from(users)
    .orderBy(desc(users.createdAt), asc(users.email));
}

// True for Postgres unique-constraint violations (SQLSTATE 23505) — here, the
// `users.email` unique index rejecting a duplicate. drizzle 1.0 wraps driver
// errors in a DrizzleQueryError, so the SQLSTATE lives on `.cause`; walk the
// chain rather than only checking the top-level error.
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e != null; e = (e as { cause?: unknown }).cause) {
    if (
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
  }
  return false;
}

export type CreateUserResult =
  | { ok: true; member: MemberRow }
  | { ok: false; reason: "duplicate" };

// Explicit column list — never spread caller input into the VALUES clause.
export async function createUser(input: {
  email: string;
  name: string | null;
}): Promise<CreateUserResult> {
  try {
    const [row] = await db
      .insert(users)
      .values({ email: input.email, name: input.name })
      .returning(memberColumns);
    if (!row) throw new Error("Failed to create user");
    return { ok: true, member: row };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "duplicate" };
    throw err;
  }
}

export type UpdateUserResult =
  | { ok: true; member: MemberRow }
  | { ok: false; reason: "duplicate" | "missing" };

// Edit a member's name and/or email in place. Email is canonicalised upstream
// (trim + lowercase) so it still matches the unique index and future sign-ins.
// Setting the email to the row's *own* current value is a no-op for the unique
// index (it only conflicts with *other* rows), so an unchanged email never
// false-positives as a duplicate; only a collision with another member does.
export async function updateUser(
  id: string,
  input: { email: string; name: string | null },
): Promise<UpdateUserResult> {
  try {
    const [row] = await db
      .update(users)
      .set({ email: input.email, name: input.name })
      .where(eq(users.id, id))
      .returning(memberColumns);
    if (!row) return { ok: false, reason: "missing" };
    return { ok: true, member: row };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "duplicate" };
    throw err;
  }
}

export type ImportRow = { email: string; name: string | null };
export type ImportResult = {
  added: number;
  alreadyMembers: number;
  updated: number;
};

// Ingest a validated CSV batch in one transaction. Emails already on the list
// are skipped (not errored) so a single existing member can't sink the import;
// the batch is de-duped server-side first because two identical keys in one
// INSERT would trip the conflict arbiter. `alreadyMembers` counts the distinct
// emails that were already present. In-file duplicates and malformed rows are
// filtered and counted by the caller before they reach here.
//
// Re-importing is also how an admin fills in names they didn't have first time
// round: an existing member with no name takes the one the file supplies
// (counted as `updated`). A name already on the record is never overwritten —
// the admin may have corrected it here, and a stale export shouldn't undo that.
export async function createUsers(rows: ImportRow[]): Promise<ImportResult> {
  const seen = new Set<string>();
  const unique: ImportRow[] = [];
  for (const row of rows) {
    if (seen.has(row.email)) continue;
    seen.add(row.email);
    unique.push(row);
  }
  if (unique.length === 0) return { added: 0, alreadyMembers: 0, updated: 0 };

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values(unique.map((r) => ({ email: r.email, name: r.name })))
      .onConflictDoNothing({ target: users.email })
      .returning({ email: users.email });

    const insertedEmails = new Set(inserted.map((r) => r.email));
    const fills = new Map(
      unique
        .filter((r) => r.name !== null && !insertedEmails.has(r.email))
        .map((r) => [r.email, r.name] as const),
    );

    // One lookup for the members that both exist and are missing a name, then
    // a write per row that actually needs one — in practice a handful, not the
    // whole batch.
    let updated = 0;
    if (fills.size > 0) {
      const nameless = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(
            inArray(users.email, [...fills.keys()]),
            or(isNull(users.name), eq(users.name, "")),
          ),
        );
      for (const member of nameless) {
        await tx
          .update(users)
          .set({ name: fills.get(member.email) ?? null })
          .where(eq(users.id, member.id));
        updated++;
      }
    }

    return {
      added: inserted.length,
      alreadyMembers: unique.length - inserted.length,
      updated,
    };
  });
}

export async function setSubscribed(
  id: string,
  subscribed: boolean,
): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ subscribed })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return Boolean(row);
}

export type BulkSubscribeResult = { changed: number; unchanged: number };

// The members table's bulk subscribe/unsubscribe. One statement inside a
// transaction, so a batch either lands whole or not at all. Rows already in the
// requested state are left alone and counted separately, so the result line can
// say something true ("12 subscribed · 2 already were") rather than claim work
// it didn't do. Unlike removal there is nothing to guard: a subscription flag
// can't lock anyone out, so the acting admin's own row is fair game.
export async function setSubscribedMany(
  targetIds: string[],
  subscribed: boolean,
): Promise<BulkSubscribeResult> {
  const ids = [...new Set(targetIds)];
  if (ids.length === 0) return { changed: 0, unchanged: 0 };

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, ids));
    const changed = await tx
      .update(users)
      .set({ subscribed })
      .where(and(inArray(users.id, ids), ne(users.subscribed, subscribed)))
      .returning({ id: users.id });
    return {
      changed: changed.length,
      unchanged: found.length - changed.length,
    };
  });
}

export type AdminChangeResult =
  | { ok: true }
  | { ok: false; reason: "self" | "last-admin" | "missing" };

// Promotion is always safe. Demotion is guarded so the admin can't lock the
// club out of its own admin: you can't demote yourself, and you can't remove
// the final admin (the only way back in would be the `db:admin` CLI). The count
// locks the admin rows (FOR UPDATE) inside the transaction — without the lock,
// two concurrent demotions could each count two admins and leave zero.
export async function setAdmin(
  targetId: string,
  makeAdmin: boolean,
  currentUserId: string,
): Promise<AdminChangeResult> {
  if (makeAdmin) {
    const [row] = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, targetId))
      .returning({ id: users.id });
    return row ? { ok: true } : { ok: false, reason: "missing" };
  }

  if (targetId === currentUserId) return { ok: false, reason: "self" };

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target) return { ok: false, reason: "missing" };
    if (target.isAdmin) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isAdmin, true))
        .for("update");
      if (admins.length <= 1) return { ok: false, reason: "last-admin" };
    }
    await tx
      .update(users)
      .set({ isAdmin: false })
      .where(eq(users.id, targetId));
    return { ok: true };
  });
}

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; reason: "self" | "last-admin" | "missing" };

// Removing a member revokes their access. Guards mirror `setAdmin`: an admin
// can't remove themselves, and removing the last admin is refused. Sessions FK
// onto users with ON DELETE CASCADE, but we delete them explicitly too so the
// intent — this person can no longer sign in — is legible at the call site.
export async function deleteUser(
  targetId: string,
  currentUserId: string,
): Promise<DeleteUserResult> {
  if (targetId === currentUserId) return { ok: false, reason: "self" };

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target) return { ok: false, reason: "missing" };
    if (target.isAdmin) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isAdmin, true))
        .for("update");
      if (admins.length <= 1) return { ok: false, reason: "last-admin" };
    }
    await tx.delete(sessions).where(eq(sessions.userId, targetId));
    await tx.delete(users).where(eq(users.id, targetId));
    return { ok: true };
  });
}

export type BulkDeleteResult = {
  removed: number;
  /** 1 if the acting admin selected their own row (always refused). */
  skippedSelf: number;
  /** Admins refused because removing them would leave the club with none. */
  skippedAdmins: number;
  /** Selected ids that were already gone (a stale table). */
  missing: number;
};

// The members table's bulk removal. `deleteUser`'s guard rails hold here too,
// but bulk can't be all-or-nothing about them: one protected row shouldn't sink
// a 200-row batch an admin has just built. So the protected rows are refused
// individually and reported back — the acting admin's own row is always
// skipped, and if the batch would strip the last admin, *every* admin in it is
// skipped (refusing them all beats silently choosing a survivor). Everything
// else happens in one transaction: a mid-batch failure leaves the list as it
// was, never half-pruned.
export async function deleteUsers(
  targetIds: string[],
  currentUserId: string,
): Promise<BulkDeleteResult> {
  const ids = [...new Set(targetIds)];
  const skippedSelf = ids.includes(currentUserId) ? 1 : 0;
  const candidates = ids.filter((id) => id !== currentUserId);
  if (candidates.length === 0) {
    return { removed: 0, skippedSelf, skippedAdmins: 0, missing: 0 };
  }

  return db.transaction(async (tx) => {
    // Lock every admin row for the transaction, as the single-row delete does:
    // without it two concurrent batches could each count enough admins left
    // over and between them leave zero.
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isAdmin, true))
      .for("update");

    const found = await tx
      .select({ id: users.id, isAdmin: users.isAdmin })
      .from(users)
      .where(inArray(users.id, candidates));

    const adminsInBatch = found.filter((u) => u.isAdmin).map((u) => u.id);
    // In practice the acting admin is an admin and is already excluded, so an
    // admin always survives; this still catches the race where they were
    // demoted by someone else while this batch was being assembled.
    const wouldStripLastAdmin = admins.length - adminsInBatch.length < 1;
    const spared = new Set<string>(wouldStripLastAdmin ? adminsInBatch : []);
    const toDelete = found.map((u) => u.id).filter((id) => !spared.has(id));

    if (toDelete.length > 0) {
      // Sessions cascade on delete, but drop them explicitly so the intent —
      // these people can no longer sign in — is legible here, as in deleteUser.
      await tx.delete(sessions).where(inArray(sessions.userId, toDelete));
      await tx.delete(users).where(inArray(users.id, toDelete));
    }

    return {
      removed: toDelete.length,
      skippedSelf,
      skippedAdmins: spared.size,
      missing: candidates.length - found.length,
    };
  });
}
