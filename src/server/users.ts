import "server-only";
import type { AdminPostingName } from "./member-profile";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { likePattern } from "@/lib/like-pattern";
import {
  ADMIN_LIST_PAGE_SIZE,
  pageBounds,
  type PagedList,
} from "@/lib/pagination";
import { chunked } from "./id-chunks";

// Server-only data access for the club member list (the `users` table). All
// callers (server components, server actions) go through here — never query
// Drizzle from a component. Membership = presence on this list; removing a row
// revokes a person's ability to sign in; that path lives in member-removal.ts.

// The columns the members UI needs — never `select()` the whole row, so the
// bearer session token and email-verification timestamp stay server-side.
const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  notes: users.notes,
  isAdmin: users.isAdmin,
  subscribed: users.subscribed,
  createdAt: users.createdAt,
} as const;

export type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  notes: string | null;
  isAdmin: boolean;
  subscribed: boolean;
  createdAt: Date;
  /** Their posting names (#300), attached by the members page. */
  postingNames?: AdminPostingName[];
};

export type MemberList = PagedList<MemberRow> & {
  /** Whole-club numbers for the summary line, independent of the search. */
  total: number;
  subscribedTotal: number;
};

// The status filters the list offers beside the search (issue #123). Like the
// search they run in the database, because the list only serves one page.
export type MemberFilter = "all" | "admins" | "subscribed" | "unsubscribed";

const FILTER_CONDITIONS = {
  all: undefined,
  admins: eq(users.isAdmin, true),
  subscribed: eq(users.subscribed, true),
  unsubscribed: eq(users.subscribed, false),
} as const;

// The WHERE for a search + status filter, shared by listUsers and
// listMatchingUserIds so "matching" can never mean two different things.
function memberWhere(query: string, filter: MemberFilter) {
  const conditions = [
    query
      ? or(
          ilike(users.name, likePattern(query)),
          ilike(users.email, likePattern(query)),
          ilike(users.notes, likePattern(query)),
        )
      : undefined,
    FILTER_CONDITIONS[filter],
  ].filter((c) => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// Newest first so a just-added member (and a fresh import) surfaces at the top;
// email as a stable tiebreaker for the many near-simultaneous CSV rows. That
// fixed, stable order is what makes plain offset paging safe here. The search
// runs in the database so it sees every member, not just the served page; an
// out-of-range page is clamped rather than 404ed, so the URL an admin held
// while rows were being removed still lands on the nearest real page.
//
// Two statements — every count in one aggregate pass, then the page's rows —
// inside a read-only REPEATABLE READ transaction, so both read one snapshot:
// the clamp is computed from the same world the rows come from, and a bulk
// removal landing mid-request can't produce an empty page labelled in-range
// or totals that disagree with the rows below them.
export async function listUsers(
  opts: { query?: string; page?: number; filter?: MemberFilter } = {},
): Promise<MemberList> {
  const query = opts.query?.trim() ?? "";
  const where = memberWhere(query, opts.filter ?? "all");

  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({
          total: count(),
          subscribedTotal:
            sql`count(*) filter (where ${users.subscribed})`.mapWith(Number),
          matching: where
            ? sql`count(*) filter (where ${where})`.mapWith(Number)
            : count(),
        })
        .from(users);
      const matching = counts?.matching ?? 0;

      const bounds = pageBounds(matching, ADMIN_LIST_PAGE_SIZE, opts.page);

      const rows = await tx
        .select(memberColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), asc(users.email))
        .limit(ADMIN_LIST_PAGE_SIZE)
        .offset(bounds.offset);

      return {
        rows,
        page: bounds.page,
        pageCount: bounds.pageCount,
        matching,
        total: counts?.total ?? 0,
        subscribedTotal: counts?.subscribedTotal ?? 0,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Every id matching a search + filter — the bulk bar's "Select all N
// matching". Fetched on demand when the admin asks for it, not shipped with
// every page render: ids for the whole club ride the wire once per gesture
// instead of once per keystroke.
//
// `limit` is required rather than optional, because these ids go straight back
// up as a bulk action's argument and that argument has a size the wire will
// carry (see features/members/selection-limit) — an unbounded read here would
// be a selection nothing could act on. The order is listUsers' order, so a
// bounded answer is the *top of the list the admin is looking at* rather than
// an arbitrary slice: "select the first N" means the N they can see.
export async function listMatchingUserIds(opts: {
  query?: string;
  filter?: MemberFilter;
  limit: number;
}): Promise<string[]> {
  const query = opts.query?.trim() ?? "";
  const where = memberWhere(query, opts.filter ?? "all");
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.email))
    .limit(opts.limit);
  return rows.map((r) => r.id);
}

export type CreateUserResult =
  | { ok: true; member: MemberRow }
  | { ok: false; reason: "duplicate" };

// Explicit column list — never spread caller input into the VALUES clause.
export async function createUser(input: {
  email: string;
  name: string | null;
  notes: string | null;
}): Promise<CreateUserResult> {
  try {
    const [row] = await db
      .insert(users)
      .values({ email: input.email, name: input.name, notes: input.notes })
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

// Edit a member's name, email and/or notes in place. Email is canonicalised upstream
// (trim + lowercase) so it still matches the unique index and future sign-ins.
// Setting the email to the row's *own* current value is a no-op for the unique
// index (it only conflicts with *other* rows), so an unchanged email never
// false-positives as a duplicate; only a collision with another member does.
export async function updateUser(
  id: string,
  input: { email: string; name: string | null; notes: string | null },
): Promise<UpdateUserResult> {
  try {
    const [row] = await db
      .update(users)
      .set({ email: input.email, name: input.name, notes: input.notes })
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

// The members table's bulk subscribe/unsubscribe. One transaction, so a batch
// either lands whole or not at all — a whole-club selection reaches the
// database as several statements (see `chunked`) but still commits once. Rows
// already in the requested state are left alone and counted separately, so the
// result line can say something true ("12 subscribed · 2 already were") rather
// than claim work it didn't do. Unlike removal there is nothing to guard: a
// subscription flag can't lock anyone out, so the acting admin's own row is
// fair game.
export async function setSubscribedMany(
  targetIds: string[],
  subscribed: boolean,
): Promise<BulkSubscribeResult> {
  const ids = [...new Set(targetIds)];
  if (ids.length === 0) return { changed: 0, unchanged: 0 };

  return db.transaction(async (tx) => {
    let found = 0;
    let changed = 0;
    for (const batch of chunked(ids)) {
      const [counted] = await tx
        .select({ n: count() })
        .from(users)
        .where(inArray(users.id, batch));
      found += counted?.n ?? 0;
      const updated = await tx
        .update(users)
        .set({ subscribed })
        .where(and(inArray(users.id, batch), ne(users.subscribed, subscribed)))
        .returning({ id: users.id });
      changed += updated.length;
    }
    return { changed, unchanged: found - changed };
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
