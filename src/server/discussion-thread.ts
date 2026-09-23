import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, issues, users } from "@/db/schema";
import { toThreadEntries, type ThreadPayload } from "@/lib/discussion-thread";
import { listComments, type CommentViewer } from "./comments";
import { getMemberIdentity } from "./member-names";
import { requireAdmin } from "./session";
import { getSettings } from "./settings";

// The reader's discussion (issue #301): the thread as the list route sends it,
// and the counts the admin's delete confirmations quote. The writes stay in
// comments.ts and comment-moderation.ts.

/** A published issue's id by its number; drafts have none to find. */
export async function publishedIssueId(number: number): Promise<string | null> {
  const [row] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.number, number), eq(issues.status, "published")))
    .limit(1);
  return row?.id ?? null;
}

// The name on the member's newest comment anywhere, while it is still one of
// theirs to post under — the composer's starting choice.
async function lastUsedNameId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ nameId: comments.authorNameId })
    .from(comments)
    .where(and(eq(comments.authorId, userId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt))
    .limit(1);
  return row?.nameId ?? null;
}

/** The thread shaped for the signed-in viewer, with their composer set-up;
 *  `pageIds` narrows it to the comments tagged to those pages (#304). */
export async function loadThreadPayload(
  issueId: string,
  viewer: NonNullable<CommentViewer>,
  opts: { pageIds?: string[] } = {},
): Promise<ThreadPayload> {
  const [thread, identity, lastUsed, account, settings] = await Promise.all([
    listComments(issueId, viewer, opts),
    getMemberIdentity(viewer.id),
    lastUsedNameId(viewer.id),
    db.select({ name: users.name }).from(users).where(eq(users.id, viewer.id)),
    getSettings(),
  ]);
  const { names } = identity;
  const accountName = account[0]?.name ?? null;
  return {
    viewer: thread.viewer,
    entries: toThreadEntries(thread),
    composer: {
      names,
      defaultNameId:
        names.find((n) => n.id === lastUsed)?.id ?? names[0]?.id ?? null,
      suggestion: names.length === 0 ? (accountName?.trim() ?? "") : "",
      rules: { reserved: [settings.name, settings.org], accountName },
    },
  };
}

// What deleting these issues takes with it: every comment not already
// deleted, hidden ones included, whether or not discussion is switched on.
export async function countIssueComments(
  issueIds: string[],
): Promise<Record<string, number>> {
  await requireAdmin();
  if (issueIds.length === 0) return {};
  const rows = await db
    .select({ issueId: comments.issueId, n: count() })
    .from(comments)
    .where(and(inArray(comments.issueId, issueIds), isNull(comments.deletedAt)))
    .groupBy(comments.issueId);
  return Object.fromEntries(rows.map((row) => [row.issueId, row.n]));
}
