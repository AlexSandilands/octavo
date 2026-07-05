import "server-only";
import { asc, desc, eq } from "drizzle-orm";
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
export type ImportResult = { added: number; alreadyMembers: number };

// Ingest a validated CSV batch in one transaction. Emails already on the list
// are skipped (not errored) so a single existing member can't sink the import;
// the batch is de-duped server-side first because two identical keys in one
// INSERT would trip the conflict arbiter. `alreadyMembers` counts the distinct
// emails that were already present. In-file duplicates and malformed rows are
// filtered and counted by the caller before they reach here.
export async function createUsers(rows: ImportRow[]): Promise<ImportResult> {
  const seen = new Set<string>();
  const unique: ImportRow[] = [];
  for (const row of rows) {
    if (seen.has(row.email)) continue;
    seen.add(row.email);
    unique.push(row);
  }
  if (unique.length === 0) return { added: 0, alreadyMembers: 0 };

  const inserted = await db.transaction((tx) =>
    tx
      .insert(users)
      .values(unique.map((r) => ({ email: r.email, name: r.name })))
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id }),
  );
  return {
    added: inserted.length,
    alreadyMembers: unique.length - inserted.length,
  };
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
