import "server-only";
import { cache } from "react";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, images, memberNames, users } from "@/db/schema";
import {
  MAX_ACTIVE_NAMES,
  type MemberNameView,
  type WriteResult,
} from "@/lib/comments";
import { isUniqueViolation } from "@/lib/db-errors";
import { checkMemberName, type MemberNameCheck } from "@/lib/member-name";
import { keyToUrl } from "@/lib/storage";
import {
  collectReferencedImageIds,
  sweepOrphanedObjects,
  takeOrphanedImages,
  type Tx,
} from "./asset-cleanup";
import {
  INVALID,
  discussionLimits,
  overLimit,
  type Refusal,
} from "./discussion-guard";
import { requireAdmin, requireMember } from "./session";
import { getSettings } from "./settings";

// Posting names (issue #299): the names an account posts under, each with an
// optional avatar. Every write derives the account from the session, never
// from its input. `users.name` is the club's record and never a posting name.

const ALREADY = "You already have this name.";

const id = z.string().min(1).max(64);
const nameInput = z.object({ name: z.string().max(200) }).strict();
const renameInput = z
  .object({ nameId: id, name: z.string().max(200) })
  .strict();
const avatarInput = z.object({ nameId: id, imageId: id }).strict();
const badgeInput = z.object({ nameId: id, badge: z.boolean() }).strict();

// The picker's rows: unretired, oldest first, avatar resolved, badge honoured
// only while the account is an admin.
async function namesOf(userId: string): Promise<MemberNameView[]> {
  const rows = await db
    .select({
      id: memberNames.id,
      name: memberNames.name,
      avatarKey: images.key,
      badge: memberNames.badge,
      isAdmin: users.isAdmin,
    })
    .from(memberNames)
    .innerJoin(users, eq(users.id, memberNames.userId))
    .leftJoin(images, eq(images.id, memberNames.avatarImageId))
    .where(and(eq(memberNames.userId, userId), isNull(memberNames.retiredAt)))
    .orderBy(asc(memberNames.createdAt), asc(memberNames.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarKey ? keyToUrl(row.avatarKey) : null,
    badge: row.badge && row.isAdmin,
  }));
}

/** What the header and composer need about the signed-in member, once per
 *  request: their names, and the one the composer starts on (the oldest). */
export const getMemberIdentity = cache(async (userId: string) => {
  const names = await namesOf(userId);
  return { names, defaultName: names[0] ?? null };
});

export async function listMyNames(): Promise<MemberNameView[]> {
  const member = await requireMember();
  return namesOf(member.id);
}

// The magazine and club names are reserved alongside the fixed words.
async function reservedNames(): Promise<string[]> {
  const settings = await getSettings();
  return [settings.name, settings.org];
}

// Whether any other account posts under this name — the UI's gentle warning,
// never a refusal and never a reveal of who.
async function sharedElsewhere(key: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: memberNames.id })
    .from(memberNames)
    .where(and(eq(memberNames.nameKey, key), ne(memberNames.userId, userId)))
    .limit(1);
  return Boolean(row);
}

// The account's own row, locked so its name count can't change under us.
async function lockAccount(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  return row ?? null;
}

type NameResult = WriteResult<{
  name: MemberNameView;
  sharedWithAnotherMember: boolean;
}>;

async function answer(
  nameId: string,
  userId: string,
  key: string,
): Promise<NameResult> {
  const name = (await namesOf(userId)).find((n) => n.id === nameId);
  if (!name) return INVALID;
  return {
    ok: true,
    name,
    sharedWithAnotherMember: await sharedElsewhere(key, userId),
  };
}

// Adds a name, or restores the account's own retired one with the same key.
// A second live copy is refused by the (user_id, name_key) index.
export async function addName(input: { name: string }): Promise<NameResult> {
  const member = await requireMember();
  const parsed = nameInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const limited = overLimit(discussionLimits.names, member.id);
  if (limited) return limited;
  const reserved = await reservedNames();

  try {
    const outcome = await db.transaction(async (tx) => {
      const account = await lockAccount(tx, member.id);
      if (!account) return INVALID;
      const check = checkMemberName(parsed.data.name, {
        reserved,
        accountName: account.name,
      });
      if (!check.ok) return check;

      const own = await tx
        .select({
          id: memberNames.id,
          nameKey: memberNames.nameKey,
          retiredAt: memberNames.retiredAt,
        })
        .from(memberNames)
        .where(eq(memberNames.userId, member.id));
      const active = own.filter((row) => !row.retiredAt).length;
      const same = own.find((row) => row.nameKey === check.key);
      if (active >= MAX_ACTIVE_NAMES && !(same && !same.retiredAt)) {
        return {
          ok: false as const,
          reason: `You can have up to ${MAX_ACTIVE_NAMES} names. Remove one first.`,
        };
      }

      if (same?.retiredAt) {
        await tx
          .update(memberNames)
          .set({ name: check.name, retiredAt: null })
          .where(eq(memberNames.id, same.id));
        return { ok: true as const, id: same.id, key: check.key };
      }
      const [row] = await tx
        .insert(memberNames)
        .values({ userId: member.id, name: check.name, nameKey: check.key })
        .returning({ id: memberNames.id });
      if (!row) throw new Error("Failed to add name");
      return { ok: true as const, id: row.id, key: check.key };
    });
    if (!outcome.ok) return outcome;
    return answer(outcome.id, member.id, outcome.key);
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: ALREADY };
    throw err;
  }
}

// Writes a validated name over an existing row. Past comments follow: they
// point at the row, not a copy of the text.
async function writeName(
  nameId: string,
  ownerId: string,
  check: Extract<MemberNameCheck, { ok: true }>,
  messages: { duplicate: string; retired: string },
): Promise<NameResult> {
  try {
    const [row] = await db
      .update(memberNames)
      .set({ name: check.name, nameKey: check.key })
      .where(
        and(
          eq(memberNames.id, nameId),
          eq(memberNames.userId, ownerId),
          isNull(memberNames.retiredAt),
        ),
      )
      .returning({ id: memberNames.id });
    if (!row) return INVALID;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // The clash may be a retired name, which isn't on the picker to see.
    const [clash] = await db
      .select({ retiredAt: memberNames.retiredAt })
      .from(memberNames)
      .where(
        and(
          eq(memberNames.userId, ownerId),
          eq(memberNames.nameKey, check.key),
        ),
      );
    const reason = clash?.retiredAt ? messages.retired : messages.duplicate;
    return { ok: false, reason };
  }
  return answer(nameId, ownerId, check.key);
}

export async function renameName(input: {
  nameId: string;
  name: string;
}): Promise<NameResult> {
  const member = await requireMember();
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const limited = overLimit(discussionLimits.names, member.id);
  if (limited) return limited;
  const [account] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, member.id));
  const check = checkMemberName(parsed.data.name, {
    reserved: await reservedNames(),
    accountName: account?.name,
  });
  if (!check.ok) return check;
  return writeName(parsed.data.nameId, member.id, check, {
    duplicate: ALREADY,
    retired: "You retired that name. Add it again instead.",
  });
}

// Deletes an unused name, retires one with comments (they keep showing it).
// The account's last live name can't go. The name row is locked, so a comment
// posted under it concurrently is either counted here or refused there.
export async function removeName(
  nameId: string,
): Promise<WriteResult<{ outcome: "deleted" | "retired" }>> {
  const member = await requireMember();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  const limited = overLimit(discussionLimits.names, member.id);
  if (limited) return limited;

  type Removal =
    | { refusal: Refusal }
    | { outcome: "deleted" | "retired"; keys: string[] };
  const result = await db.transaction(async (tx): Promise<Removal> => {
    if (!(await lockAccount(tx, member.id))) return { refusal: INVALID };
    const [name] = await tx
      .select({ avatar: memberNames.avatarImageId })
      .from(memberNames)
      .where(
        and(
          eq(memberNames.id, parsed.data),
          eq(memberNames.userId, member.id),
          isNull(memberNames.retiredAt),
        ),
      )
      .for("update");
    if (!name) return { refusal: INVALID };
    const [live] = await tx
      .select({ n: count() })
      .from(memberNames)
      .where(
        and(eq(memberNames.userId, member.id), isNull(memberNames.retiredAt)),
      );
    if ((live?.n ?? 0) <= 1) {
      return {
        refusal: {
          ok: false,
          reason: "You need at least one name to post under.",
        },
      };
    }
    const [used] = await tx
      .select({ n: count() })
      .from(comments)
      .where(eq(comments.authorNameId, parsed.data));
    if ((used?.n ?? 0) > 0) {
      await tx
        .update(memberNames)
        .set({ retiredAt: new Date() })
        .where(eq(memberNames.id, parsed.data));
      return { outcome: "retired", keys: [] };
    }
    await tx.delete(memberNames).where(eq(memberNames.id, parsed.data));
    const keys = await takeOrphanedImages(tx, name.avatar ? [name.avatar] : []);
    return { outcome: "deleted", keys };
  });
  if ("refusal" in result) return result.refusal;
  await sweepOrphanedObjects({
    keys: result.keys,
    context: { memberNameId: parsed.data },
  });
  return { ok: true, outcome: result.outcome };
}

// Swaps a name's avatar (null clears it). The old image row and its object go
// in the same step, as a replaced logo's do. `ownerId` null is the admin path.
async function replaceAvatar(
  nameId: string,
  ownerId: string | null,
  imageId: string | null,
): Promise<WriteResult> {
  const result = await db.transaction(async (tx) => {
    const [name] = await tx
      .select({ avatar: memberNames.avatarImageId })
      .from(memberNames)
      .where(
        and(
          eq(memberNames.id, nameId),
          ownerId ? eq(memberNames.userId, ownerId) : undefined,
        ),
      )
      .for("update");
    if (!name) return null;
    if (imageId && imageId !== name.avatar) {
      // Only a fresh upload can become an avatar: no issue behind it and
      // nothing (a logo, a sponsor, another name) already showing it.
      const [image] = await tx
        .select({ issueId: images.issueId })
        .from(images)
        .where(eq(images.id, imageId));
      if (!image || image.issueId !== null) return null;
      if ((await collectReferencedImageIds(tx)).has(imageId)) return null;
    }
    await tx
      .update(memberNames)
      .set({ avatarImageId: imageId })
      .where(eq(memberNames.id, nameId));
    const old = name.avatar && name.avatar !== imageId ? [name.avatar] : [];
    return takeOrphanedImages(tx, old);
  });
  if (!result) return INVALID;
  await sweepOrphanedObjects({
    keys: result,
    context: { memberNameId: nameId },
  });
  return { ok: true };
}

// Takes the id the upload route has just created (#300). Never expose it as a
// server action that accepts an image id from the client.
export async function setNameAvatar(input: {
  nameId: string;
  imageId: string;
}): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = avatarInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const limited = overLimit(discussionLimits.avatar, member.id);
  if (limited) return limited;
  return replaceAvatar(parsed.data.nameId, member.id, parsed.data.imageId);
}

export async function clearNameAvatar(nameId: string): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  const limited = overLimit(discussionLimits.avatar, member.id);
  if (limited) return limited;
  return replaceAvatar(parsed.data, member.id, null);
}

// An admin marks one of their own names as badged; it renders only while they
// remain an admin.
export async function setNameBadge(input: {
  nameId: string;
  badge: boolean;
}): Promise<WriteResult> {
  const admin = await requireAdmin();
  const parsed = badgeInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const [row] = await db
    .update(memberNames)
    .set({ badge: parsed.data.badge })
    .where(
      and(
        eq(memberNames.id, parsed.data.nameId),
        eq(memberNames.userId, admin.id),
      ),
    )
    .returning({ id: memberNames.id });
  return row ? { ok: true } : INVALID;
}

// ── Admin moderation of names ───────────────────────────────────────────────

// Every rule but the profanity filter: this is how a real name the filter
// trips gets set for a member.
export async function adminRenameName(input: {
  nameId: string;
  name: string;
}): Promise<NameResult> {
  await requireAdmin();
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const [owner] = await db
    .select({ userId: memberNames.userId })
    .from(memberNames)
    .where(eq(memberNames.id, parsed.data.nameId));
  if (!owner) return INVALID;
  const check = checkMemberName(parsed.data.name, {
    reserved: await reservedNames(),
    skipProfanity: true,
  });
  if (!check.ok) return check;
  return writeName(parsed.data.nameId, owner.userId, check, {
    duplicate: "That member already has this name.",
    retired: "That member has retired this name. They can add it again.",
  });
}

// Retired, never deleted: the name stays on the comments posted under it.
export async function adminRetireName(nameId: string): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  const [row] = await db
    .update(memberNames)
    .set({ retiredAt: new Date() })
    .where(and(eq(memberNames.id, parsed.data), isNull(memberNames.retiredAt)))
    .returning({ id: memberNames.id });
  return row ? { ok: true } : INVALID;
}

export async function clearAvatar(nameId: string): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  return replaceAvatar(parsed.data, null, null);
}
