import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commentReports, comments, memberNames } from "@/db/schema";
import {
  FORMER_MEMBER,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  type WriteResult,
} from "@/lib/comments";
import type { Tx } from "./asset-cleanup";
import { removeLockedComment } from "./comments";
import {
  INVALID,
  cleanText,
  discussionLimits,
  discussionOff,
  overLimit,
} from "./discussion-guard";
import { notifyAdminsOfReport } from "./report-alert";
import { requireAdmin, requireMember } from "./session";

// Moderation (issue #299): admins hide, unhide and delete any comment and work
// the reports inbox; any member can report someone else's comment. Admin
// writes work whether or not discussion is switched on, so a thread can still
// be cleaned up after it is turned off. Hiding or deleting a comment resolves
// every open report on it (issue #302); the inbox itself is report-inbox.ts.

const id = z.string().min(1).max(64);
const reportInput = z
  .object({
    commentId: id,
    reason: z.enum(REPORT_REASONS),
    note: z
      .string()
      .max(REPORT_NOTE_MAX * 2)
      .nullish()
      .transform((value) => cleanText(value ?? ""))
      .pipe(z.string().max(REPORT_NOTE_MAX))
      .transform((value) => (value === "" ? null : value)),
  })
  .strict();

// Settles every open report on a comment in the caller's transaction, as the
// admin who acted on it.
async function resolveOpenReports(
  tx: Tx,
  commentId: string,
  adminId: string,
  at: Date,
) {
  await tx
    .update(commentReports)
    .set({ status: "resolved", resolvedBy: adminId, resolvedAt: at })
    .where(
      and(
        eq(commentReports.commentId, commentId),
        eq(commentReports.status, "open"),
      ),
    );
}

async function setHidden(commentId: string, hidden: boolean) {
  const admin = await requireAdmin();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ hiddenAt: comments.hiddenAt })
      .from(comments)
      .where(eq(comments.id, parsed.data))
      .for("update");
    if (!row) return INVALID;
    const now = new Date();
    // Hiding twice keeps the first time; either way its reports are settled.
    await tx
      .update(comments)
      .set({ hiddenAt: hidden ? (row.hiddenAt ?? now) : null })
      .where(eq(comments.id, parsed.data));
    if (hidden) await resolveOpenReports(tx, parsed.data, admin.id, now);
    return { ok: true as const };
  });
}

/** Reversible: members see a hidden comment as removed (or not at all). */
export async function hideComment(commentId: string): Promise<WriteResult> {
  return setHidden(commentId, true);
}

export async function unhideComment(commentId: string): Promise<WriteResult> {
  return setHidden(commentId, false);
}

// The author's rule — a stub while it has replies, otherwise gone — except
// that a reported comment is always kept, blanked and hidden: its reports are
// resolved here, and the hidden flag is how the inbox tells an admin's removal
// from its author's.
export async function deleteComment(commentId: string): Promise<WriteResult> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ deletedAt: comments.deletedAt, hiddenAt: comments.hiddenAt })
      .from(comments)
      .where(eq(comments.id, parsed.data))
      .for("update");
    if (!row) return INVALID;
    const now = new Date();
    await resolveOpenReports(tx, parsed.data, admin.id, now);
    if (row.deletedAt) return { ok: true as const };
    const [reported] = await tx
      .select({ id: commentReports.id })
      .from(commentReports)
      .where(eq(commentReports.commentId, parsed.data))
      .limit(1);
    if (reported) {
      await tx
        .update(comments)
        .set({ body: "", deletedAt: now, hiddenAt: row.hiddenAt ?? now })
        .where(eq(comments.id, parsed.data));
    } else {
      await removeLockedComment(tx, parsed.data);
    }
    return { ok: true as const };
  });
}

const THANKS = { ok: true } as const;

// Files a report, snapshotting the comment as it reads now. It always thanks
// the reporter — for their own comment, a removed one, or a second report of
// the same comment it quietly writes nothing. Only a new row emails the
// admins, after the commit, and a failed email never reaches the reporter.
export async function createReport(input: {
  commentId: string;
  reason: string;
  note?: string | null;
}): Promise<WriteResult> {
  const member = await requireMember();
  const parsed = reportInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const off = await discussionOff();
  if (off) return off;
  const limited = overLimit(discussionLimits.report, member.id);
  if (limited) return limited;

  const inserted = await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({
        issueId: comments.issueId,
        authorId: comments.authorId,
        body: comments.body,
        name: memberNames.name,
        hiddenAt: comments.hiddenAt,
        deletedAt: comments.deletedAt,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
      })
      .from(comments)
      .leftJoin(memberNames, eq(memberNames.id, comments.authorNameId))
      .where(eq(comments.id, parsed.data.commentId))
      .for("share", { of: comments });
    if (
      !comment ||
      comment.hiddenAt ||
      comment.deletedAt ||
      comment.authorId === member.id
    ) {
      return null;
    }
    const [row] = await tx
      .insert(commentReports)
      .values({
        commentId: parsed.data.commentId,
        issueId: comment.issueId,
        reporterId: member.id,
        reason: parsed.data.reason,
        note: parsed.data.note,
        snapshotBody: comment.body,
        snapshotName: comment.authorId
          ? (comment.name ?? FORMER_MEMBER)
          : FORMER_MEMBER,
        snapshotAuthorId: comment.authorId,
        snapshotCreatedAt: comment.createdAt,
        snapshotEditedAt: comment.editedAt,
      })
      .onConflictDoNothing({
        target: [commentReports.commentId, commentReports.reporterId],
      })
      .returning({ id: commentReports.id });
    return row ?? null;
  });
  if (inserted) {
    try {
      await notifyAdminsOfReport(inserted.id);
    } catch (err) {
      console.error("[report] admin email failed", err);
      Sentry.captureException(err, { tags: { stage: "report-email" } });
    }
  }
  return THANKS;
}

export async function resolveReport(reportId: string): Promise<WriteResult> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(reportId);
  if (!parsed.success) return INVALID;
  const [row] = await db
    .update(commentReports)
    .set({ status: "resolved", resolvedBy: admin.id, resolvedAt: new Date() })
    .where(
      and(
        eq(commentReports.id, parsed.data),
        eq(commentReports.status, "open"),
      ),
    )
    .returning({ id: commentReports.id });
  return row ? { ok: true } : INVALID;
}
