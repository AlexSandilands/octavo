import "server-only";
import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { comments, images, memberNames, users } from "@/db/schema";
import type { MemberNameView, NameRetiredBy } from "@/lib/comments";
import { keyToUrl } from "@/lib/storage";
import { sweepOrphanedObjects, takeOrphanedImages } from "./asset-cleanup";
import { getMemberIdentity } from "./member-names";
import { requireAdmin } from "./session";

// Reads and writes for the member profile page and the admin's view of posting
// names (issue #300). Name writes themselves live in member-names.ts.

export type ProfileName = MemberNameView & { commentCount: number };

/** The account's unretired names with how many comments each carries, so
 *  Remove can say beforehand whether it retires or deletes. */
export async function getProfileNames(userId: string): Promise<ProfileName[]> {
  const { names } = await getMemberIdentity(userId);
  if (names.length === 0) return [];
  const counts = await db
    .select({ nameId: comments.authorNameId, n: count() })
    .from(comments)
    .where(
      inArray(
        comments.authorNameId,
        names.map((n) => n.id),
      ),
    )
    .groupBy(comments.authorNameId);
  const byName = new Map(counts.map((row) => [row.nameId, row.n]));
  return names.map((n) => ({ ...n, commentCount: byName.get(n.id) ?? 0 }));
}

export async function getEmailPreferences(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      subscribed: users.subscribed,
      replyEmails: users.replyEmails,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

export async function setReplyEmails(userId: string, on: boolean) {
  await db.update(users).set({ replyEmails: on }).where(eq(users.id, userId));
}

/** Drops an upload that never became an avatar: its row, if nothing shows it,
 *  then its object. */
export async function discardUpload(imageId: string) {
  const keys = await db.transaction((tx) => takeOrphanedImages(tx, [imageId]));
  await sweepOrphanedObjects({ keys, context: { route: "profile/avatar" } });
}

/** One posting name as the admin members list shows it. */
export type AdminPostingName = {
  id: string;
  name: string;
  avatarUrl: string | null;
  retired: boolean;
  /** An admin's retirement sticks; a member's own can be retired again. */
  retiredBy: NameRetiredBy | null;
};

/** Every posting name of the given accounts, live first then retired, oldest
 *  first within each. Admin only. */
export async function listPostingNamesFor(
  userIds: string[],
): Promise<Map<string, AdminPostingName[]>> {
  await requireAdmin();
  const byUser = new Map<string, AdminPostingName[]>();
  if (userIds.length === 0) return byUser;
  const rows = await db
    .select({
      id: memberNames.id,
      userId: memberNames.userId,
      name: memberNames.name,
      avatarKey: images.key,
      retiredAt: memberNames.retiredAt,
      retiredBy: memberNames.retiredBy,
    })
    .from(memberNames)
    .leftJoin(images, eq(images.id, memberNames.avatarImageId))
    .where(inArray(memberNames.userId, userIds))
    .orderBy(asc(memberNames.createdAt), asc(memberNames.id));
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatarKey ? keyToUrl(row.avatarKey) : null,
      retired: row.retiredAt !== null,
      retiredBy: row.retiredAt ? row.retiredBy : null,
    });
    byUser.set(row.userId, list);
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => Number(a.retired) - Number(b.retired));
  }
  return byUser;
}
