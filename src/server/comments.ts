import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  commentReports,
  comments,
  images,
  issues,
  memberNames,
  users,
} from "@/db/schema";
import {
  COMMENT_BODY_MAX,
  FORMER_MEMBER,
  type AdminCommentView,
  type CommentDeletedBy,
  type CommentThread,
  type MemberCommentView,
  type MemberThreadEntry,
  type WriteResult,
} from "@/lib/comments";
import { keyToUrl } from "@/lib/storage";
import type { Tx } from "./asset-cleanup";
import {
  INVALID,
  cleanText,
  discussionLimits,
  discussionOff,
  overLimit,
} from "./discussion-guard";
import { notifyReply } from "./notifications";
import { requireMember } from "./session";
import { getSettings } from "./settings";

// An issue's discussion thread (issue #299): top-level comments and one level
// of replies, plain text. Reads are shaped for the viewer — a member never
// receives an email, an author id or a removed comment's words. Every write
// derives the author from the session, never from its input.

/** Who is reading: the session's user, or null for a signed-out visitor. */
export type CommentViewer = { id: string; isAdmin: boolean } | null;

const id = z.string().min(1).max(64);
const body = z
  .string()
  .max(COMMENT_BODY_MAX * 2)
  .transform(cleanText)
  .pipe(z.string().min(1).max(COMMENT_BODY_MAX));
const createInput = z
  .object({
    issueId: id,
    parentId: id.nullish(),
    body,
    nameId: id,
    pageId: id.nullish(),
  })
  .strict();
const editInput = z.object({ commentId: id, body }).strict();

// Explicit column list: the joined name, avatar and account come along, the
// email never does.
const threadSelection = {
  id: comments.id,
  parentId: comments.parentId,
  body: comments.body,
  pageId: comments.pageId,
  hiddenAt: comments.hiddenAt,
  deletedAt: comments.deletedAt,
  createdAt: comments.createdAt,
  editedAt: comments.editedAt,
  authorId: comments.authorId,
  name: memberNames.name,
  badge: memberNames.badge,
  avatarKey: images.key,
  authorIsAdmin: users.isAdmin,
  accountName: users.name,
};
type ThreadRow = Awaited<ReturnType<typeof threadRows>>[number];

function threadRows(issueId: string) {
  return db
    .select(threadSelection)
    .from(comments)
    .leftJoin(memberNames, eq(memberNames.id, comments.authorNameId))
    .leftJoin(images, eq(images.id, memberNames.avatarImageId))
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.issueId, issueId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

// A removed member's comment keeps no name or avatar; the badge needs the
// account to be an admin right now, so a demotion drops it.
function memberView(row: ThreadRow, viewerId: string): MemberCommentView {
  const name = row.authorId !== null ? row.name : null;
  const attributed = name !== null;
  return {
    id: row.id,
    removed: false,
    body: row.body,
    name: name ?? FORMER_MEMBER,
    avatarUrl: attributed && row.avatarKey ? keyToUrl(row.avatarKey) : null,
    badge: attributed && row.badge === true && row.authorIsAdmin === true,
    isMine: row.authorId === viewerId,
    pageId: row.pageId,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
  };
}

function adminView(row: ThreadRow, viewerId: string): AdminCommentView {
  const hidden = row.hiddenAt !== null;
  const deleted = row.deletedAt !== null;
  return {
    ...memberView(row, viewerId),
    removed: hidden || deleted,
    hidden,
    deleted,
    account: row.authorId ? { id: row.authorId, name: row.accountName } : null,
  };
}

const isRemoved = (row: ThreadRow) =>
  row.hiddenAt !== null || row.deletedAt !== null;

// An issue's thread, oldest first, shaped for the viewer. A member gets
// nothing while discussion is off or the issue is unpublished; a hidden or
// deleted top-level comment reaches them only as a stub, and only while it has
// visible replies. Admins get every row, flagged. `pageIds` keeps the
// top-level comments tagged to those pages (replies follow their parent).
export async function listComments(
  issueId: string,
  viewer: CommentViewer,
  opts: { pageIds?: string[] } = {},
): Promise<CommentThread> {
  if (!viewer) return { viewer: "member", entries: [] };
  if (!viewer.isAdmin) {
    const [issue] = await db
      .select({ status: issues.status })
      .from(issues)
      .where(eq(issues.id, issueId));
    const { commentsEnabled } = await getSettings();
    if (!commentsEnabled || issue?.status !== "published") {
      return { viewer: "member", entries: [] };
    }
  }

  const rows = await threadRows(issueId);
  const replies = new Map<string, ThreadRow[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    replies.set(row.parentId, [...(replies.get(row.parentId) ?? []), row]);
  }
  const pages = opts.pageIds ? new Set(opts.pageIds) : null;
  const tops = rows.filter(
    (row) => !row.parentId && (!pages || (row.pageId && pages.has(row.pageId))),
  );

  if (viewer.isAdmin) {
    return {
      viewer: "admin",
      entries: tops.map((top) => ({
        ...adminView(top, viewer.id),
        replies: (replies.get(top.id) ?? []).map((r) =>
          adminView(r, viewer.id),
        ),
      })),
    };
  }

  const entries: MemberThreadEntry[] = [];
  for (const top of tops) {
    const visible = (replies.get(top.id) ?? [])
      .filter((r) => !isRemoved(r))
      .map((r) => memberView(r, viewer.id));
    if (!isRemoved(top)) {
      entries.push({ ...memberView(top, viewer.id), replies: visible });
    } else if (visible.length > 0) {
      entries.push({
        id: top.id,
        removed: true,
        createdAt: top.createdAt,
        replies: visible,
      });
    }
  }
  return { viewer: "member", entries };
}

// Visible comments and replies per issue — one grouped query. Empty while
// discussion is off, so no count reaches a card.
export async function countComments(
  issueIds: string[],
): Promise<Record<string, number>> {
  if (issueIds.length === 0) return {};
  if (!(await getSettings()).commentsEnabled) return {};
  const rows = await db
    .select({ issueId: comments.issueId, n: count() })
    .from(comments)
    .where(
      and(
        inArray(comments.issueId, issueIds),
        isNull(comments.hiddenAt),
        isNull(comments.deletedAt),
      ),
    )
    .groupBy(comments.issueId);
  return Object.fromEntries(rows.map((row) => [row.issueId, row.n]));
}

type CreateInput = z.input<typeof createInput>;

// Posts a comment or a reply under one of the member's live names. The name
// and the parent are locked (FOR SHARE) so removing either can't race it.
export async function createComment(
  input: CreateInput,
): Promise<WriteResult<{ id: string }>> {
  const member = await requireMember();
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const off = await discussionOff();
  if (off) return off;
  const limited = overLimit(discussionLimits.post, member.id);
  if (limited) return limited;
  const { issueId, parentId, nameId, pageId } = parsed.data;

  return db.transaction(async (tx) => {
    const [issue] = await tx
      .select({ status: issues.status, content: issues.content })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (issue?.status !== "published") {
      return refuse("Comments open once an issue is published.");
    }
    if (pageId && !issue.content.pages.some((page) => page.id === pageId)) {
      return refuse("That page is no longer in this issue.");
    }

    const [name] = await tx
      .select({ id: memberNames.id })
      .from(memberNames)
      .where(
        and(
          eq(memberNames.id, nameId),
          eq(memberNames.userId, member.id),
          isNull(memberNames.retiredAt),
        ),
      )
      .for("share");
    if (!name) return refuse("Choose one of your names to post under.");

    let parentAuthor: string | null = null;
    if (parentId) {
      const [parent] = await tx
        .select({
          issueId: comments.issueId,
          parentId: comments.parentId,
          authorId: comments.authorId,
          hiddenAt: comments.hiddenAt,
          deletedAt: comments.deletedAt,
        })
        .from(comments)
        .where(eq(comments.id, parentId))
        .for("share");
      if (!parent || parent.issueId !== issueId) return INVALID;
      if (parent.parentId) return refuse("You can't reply to a reply.");
      if (parent.hiddenAt || parent.deletedAt) {
        return refuse("That comment has been removed.");
      }
      parentAuthor = parent.authorId;
    }

    const [row] = await tx
      .insert(comments)
      .values({
        issueId,
        authorId: member.id,
        authorNameId: nameId,
        parentId: parentId ?? null,
        body: parsed.data.body,
        pageId: pageId ?? null,
      })
      .returning({ id: comments.id });
    if (!row) throw new Error("Failed to post comment");
    if (parentAuthor && parentAuthor !== member.id) {
      await notifyReply(tx, parentAuthor, row.id);
    }
    return { ok: true as const, id: row.id };
  });
}

function refuse(reason: string) {
  return { ok: false as const, reason };
}

// The author's own edit; marks the comment "(edited)". A hidden comment is
// moderated content, so it can't be rewritten until an admin unhides it.
export async function editComment(input: {
  commentId: string;
  body: string;
}): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = editInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const off = await discussionOff();
  if (off) return off;
  const limited = overLimit(discussionLimits.edit, member.id);
  if (limited) return limited;
  const [row] = await db
    .update(comments)
    .set({ body: parsed.data.body, editedAt: new Date() })
    .where(
      and(
        eq(comments.id, parsed.data.commentId),
        eq(comments.authorId, member.id),
        isNull(comments.hiddenAt),
        isNull(comments.deletedAt),
      ),
    )
    .returning({ id: comments.id });
  return row ? { ok: true } : refuse("That comment has been removed.");
}

// Removes a comment the caller has locked FOR UPDATE: a soft delete (body
// blanked, `by` recorded) when it has replies or an open report, else a hard
// delete.
export async function removeLockedComment(
  tx: Tx,
  commentId: string,
  by: CommentDeletedBy,
): Promise<"soft" | "hard"> {
  const [reply] = await tx
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentId, commentId))
    .limit(1);
  const [report] = await tx
    .select({ id: commentReports.id })
    .from(commentReports)
    .where(
      and(
        eq(commentReports.commentId, commentId),
        eq(commentReports.status, "open"),
      ),
    )
    .limit(1);
  if (reply || report) {
    await tx
      .update(comments)
      .set({ body: "", deletedAt: new Date(), deletedBy: by })
      .where(eq(comments.id, commentId));
    return "soft";
  }
  await tx.delete(comments).where(eq(comments.id, commentId));
  return "hard";
}

// The author deleting their own comment. Decided and done in one transaction
// with the row locked, so a reply landing concurrently can't be cascaded away.
export async function deleteOwnComment(
  commentId: string,
): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  const off = await discussionOff();
  if (off) return off;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ authorId: comments.authorId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, parsed.data))
      .for("update");
    if (!row || row.authorId !== member.id) return INVALID;
    if (!row.deletedAt) await removeLockedComment(tx, parsed.data, "author");
    return { ok: true as const };
  });
}
