import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { comments, memberNames, sessions, settings, users } from "@/db/schema";
import { REMOVED_MEMBER_COMMENTS } from "@/lib/branding";
import { siteDefaults } from "@/lib/site-defaults";
import {
  sweepOrphanedObjects,
  takeOrphanedImages,
  type Tx,
} from "./asset-cleanup";
import { chunked } from "./id-chunks";

// Removing members from the club (the `users` table). Split from users.ts when
// discussion gave removal a second job (issue #299): what happens to the
// member's comments and avatars, decided inside the same transaction.

// The owner's policy, read inside the removal's transaction so it can't change
// between the decision and the delete. Unset or unreadable is the default.
async function removedMemberPolicy(tx: Tx) {
  const [row] = await tx
    .select({ policy: settings.removedMemberComments })
    .from(settings)
    .where(eq(settings.id, 1));
  const parsed = z.enum(REMOVED_MEMBER_COMMENTS).safeParse(row?.policy);
  return parsed.success ? parsed.data : siteDefaults.removedMemberComments;
}

const reply = alias(comments, "reply");

// "delete": the members' replies go, then their top-level comments — as a
// blanked stub where someone else's reply survives, else outright. Under
// "anonymise" they stay, unattributed, and render as "Former member".
async function deleteCommentsOf(tx: Tx, userIds: string[]) {
  // Lock their threads first, as deleteOwnComment does: a reply posted now
  // either committed before this (and is seen below) or waits and is refused.
  await tx
    .select({ id: comments.id })
    .from(comments)
    .where(and(inArray(comments.authorId, userIds), isNull(comments.parentId)))
    .for("update");
  await tx
    .delete(comments)
    .where(
      and(inArray(comments.authorId, userIds), isNotNull(comments.parentId)),
    );
  const hasReply = sql`exists (${tx
    .select({ one: sql`1` })
    .from(reply)
    .where(eq(reply.parentId, comments.id))})`;
  const theirs = and(
    inArray(comments.authorId, userIds),
    isNull(comments.parentId),
  );
  await tx
    .update(comments)
    .set({ body: "", deletedAt: new Date() })
    .where(and(theirs, hasReply));
  await tx.delete(comments).where(and(theirs, sql`not ${hasReply}`));
}

// Applies the comment policy to a batch about to be removed and hands back
// their avatar image ids, collected before the cascade takes the name rows.
async function prepareRemoval(
  tx: Tx,
  userIds: string[],
  policy: Awaited<ReturnType<typeof removedMemberPolicy>>,
): Promise<string[]> {
  const avatars = await tx
    .select({ imageId: memberNames.avatarImageId })
    .from(memberNames)
    .where(
      and(
        inArray(memberNames.userId, userIds),
        isNotNull(memberNames.avatarImageId),
      ),
    );
  if (policy === "delete") await deleteCommentsOf(tx, userIds);
  // Anonymise what remains by hand: left to the cascades, the user delete's
  // set-null on author_id re-checks author_name_id after the name row is gone.
  await tx
    .update(comments)
    .set({ authorId: null, authorNameId: null })
    .where(inArray(comments.authorId, userIds));
  return avatars.flatMap((row) => (row.imageId ? [row.imageId] : []));
}

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; reason: "self" | "last-admin" | "missing" };

// Removing a member revokes their access. Guards mirror `setAdmin`: an admin
// can't remove themselves, and removing the last admin is refused. Sessions FK
// onto users with ON DELETE CASCADE, but we delete them explicitly too so the
// intent — this person can no longer sign in — is legible at the call site.
// Their avatars leave storage once the transaction commits (issue #299).
export async function deleteUser(
  targetId: string,
  currentUserId: string,
): Promise<DeleteUserResult> {
  if (targetId === currentUserId) return { ok: false, reason: "self" };

  const outcome = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target) return { ok: false as const, reason: "missing" as const };
    if (target.isAdmin) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isAdmin, true))
        .for("update");
      if (admins.length <= 1) {
        return { ok: false as const, reason: "last-admin" as const };
      }
    }
    const policy = await removedMemberPolicy(tx);
    const avatars = await prepareRemoval(tx, [targetId], policy);
    await tx.delete(sessions).where(eq(sessions.userId, targetId));
    await tx.delete(users).where(eq(users.id, targetId));
    return { ok: true as const, keys: await takeOrphanedImages(tx, avatars) };
  });
  if (!outcome.ok) return outcome;
  await sweepOrphanedObjects({ keys: outcome.keys, context: { targetId } });
  return { ok: true };
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
//
// A whole-club selection is sent to the database in chunks, but the guard rails
// are not chunked: the admin lock, the lookup of who is in the selection and
// the decision about who to spare all complete before the first row is deleted,
// over the entire selection. So a chunk boundary can never be the moment the
// last admin goes. The comment policy and avatar cleanup run per chunk, before
// the chunk's rows go, and storage is swept once after the commit.
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

  const outcome = await db.transaction(async (tx) => {
    // Lock every admin row for the transaction, as the single-row delete does:
    // without it two concurrent batches could each count enough admins left
    // over and between them leave zero.
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isAdmin, true))
      .for("update");

    const found: { id: string; isAdmin: boolean }[] = [];
    for (const batch of chunked(candidates)) {
      found.push(
        ...(await tx
          .select({ id: users.id, isAdmin: users.isAdmin })
          .from(users)
          .where(inArray(users.id, batch))),
      );
    }

    const adminsInBatch = found.filter((u) => u.isAdmin).map((u) => u.id);
    // In practice the acting admin is an admin and is already excluded, so an
    // admin always survives; this still catches the race where they were
    // demoted by someone else while this batch was being assembled.
    const wouldStripLastAdmin = admins.length - adminsInBatch.length < 1;
    const spared = new Set<string>(wouldStripLastAdmin ? adminsInBatch : []);
    const toDelete = found.map((u) => u.id).filter((id) => !spared.has(id));

    const policy = await removedMemberPolicy(tx);
    const avatars: string[] = [];
    for (const batch of chunked(toDelete)) {
      avatars.push(...(await prepareRemoval(tx, batch, policy)));
      // Sessions cascade on delete, but drop them explicitly so the intent —
      // these people can no longer sign in — is legible here, as in deleteUser.
      await tx.delete(sessions).where(inArray(sessions.userId, batch));
      await tx.delete(users).where(inArray(users.id, batch));
    }

    return {
      result: {
        removed: toDelete.length,
        skippedSelf,
        skippedAdmins: spared.size,
        missing: candidates.length - found.length,
      },
      keys: await takeOrphanedImages(tx, avatars),
    };
  });
  await sweepOrphanedObjects({
    keys: outcome.keys,
    context: { removed: outcome.result.removed },
  });
  return outcome.result;
}
