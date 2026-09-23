import "server-only";
import { and, count, desc, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, issues, memberNames, notifications } from "@/db/schema";
import {
  FORMER_MEMBER,
  MAX_NOTIFICATIONS,
  type NotificationView,
  type WriteResult,
} from "@/lib/comments";
import type { Tx } from "./asset-cleanup";
import { INVALID } from "./discussion-guard";
import { requireMember } from "./session";
import { getSettings } from "./settings";

// Reply notifications (issue #299): a reply to your comment leaves a row here
// for the bell (#303). Only the newest MAX_NOTIFICATIONS per member are kept,
// trimmed on insert, so nothing needs sweeping. Email is #303's.

const EXCERPT_LENGTH = 140;

// Called by createComment inside its transaction, never for your own reply.
export async function notifyReply(
  tx: Tx,
  recipientId: string,
  commentId: string,
): Promise<void> {
  await tx.insert(notifications).values({ userId: recipientId, commentId });
  const newest = tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.userId, recipientId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(MAX_NOTIFICATIONS);
  await tx
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, recipientId),
        notInArray(notifications.id, newest),
      ),
    );
}

// A notification counts only while its reply is still visible.
const replyVisible = and(isNull(comments.hiddenAt), isNull(comments.deletedAt));

// The member's notifications, newest first. Empty while discussion is off.
export async function listNotifications(
  userId: string,
): Promise<NotificationView[]> {
  if (!(await getSettings()).commentsEnabled) return [];
  const rows = await db
    .select({
      id: notifications.id,
      commentId: notifications.commentId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      body: comments.body,
      authorId: comments.authorId,
      name: memberNames.name,
      issueNumber: issues.number,
      issueTitle: issues.title,
    })
    .from(notifications)
    .innerJoin(comments, eq(comments.id, notifications.commentId))
    .innerJoin(issues, eq(issues.id, comments.issueId))
    .leftJoin(memberNames, eq(memberNames.id, comments.authorNameId))
    .where(and(eq(notifications.userId, userId), replyVisible))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(MAX_NOTIFICATIONS);
  return rows.map((row) => ({
    id: row.id,
    commentId: row.commentId,
    issueNumber: row.issueNumber,
    issueTitle: row.issueTitle,
    replierName: (row.authorId && row.name) || FORMER_MEMBER,
    excerpt: row.body.slice(0, EXCERPT_LENGTH),
    createdAt: row.createdAt,
    read: row.readAt !== null,
  }));
}

/** The bell's number. Zero while discussion is off. */
export async function countUnread(userId: string): Promise<number> {
  if (!(await getSettings()).commentsEnabled) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .innerJoin(comments, eq(comments.id, notifications.commentId))
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        replyVisible,
      ),
    );
  return row?.n ?? 0;
}

export async function markRead(notificationId: string): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = z.string().min(1).max(64).safeParse(notificationId);
  if (!parsed.success) return INVALID;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, parsed.data),
        eq(notifications.userId, member.id),
        isNull(notifications.readAt),
      ),
    );
  return { ok: true };
}

export async function markAllRead(): Promise<WriteResult> {
  const member = await requireMember();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, member.id), isNull(notifications.readAt)),
    );
  return { ok: true };
}
