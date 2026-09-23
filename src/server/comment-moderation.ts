import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  commentReports,
  comments,
  issues,
  memberNames,
  users,
} from "@/db/schema";
import {
  FORMER_MEMBER,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  type ReportStatus,
  type ReportView,
  type WriteResult,
} from "@/lib/comments";
import { removeLockedComment } from "./comments";
import {
  INVALID,
  cleanText,
  discussionLimits,
  discussionOff,
  overLimit,
} from "./discussion-guard";
import { requireAdmin, requireMember } from "./session";

// Moderation (issue #299): admins hide, unhide and delete any comment and work
// the reports inbox; any member can report someone else's comment. Admin
// writes work whether or not discussion is switched on, so a thread can still
// be cleaned up after it is turned off.

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

async function setHidden(commentId: string, hidden: boolean) {
  await requireAdmin();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  const [row] = await db
    .update(comments)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(eq(comments.id, parsed.data))
    .returning({ id: comments.id });
  return row ? { ok: true as const } : INVALID;
}

/** Reversible: members see a hidden comment as removed (or not at all). */
export async function hideComment(commentId: string): Promise<WriteResult> {
  return setHidden(commentId, true);
}

export async function unhideComment(commentId: string): Promise<WriteResult> {
  return setHidden(commentId, false);
}

// The same rule as the author's own delete: a stub while it has replies or an
// open report, otherwise gone.
export async function deleteComment(commentId: string): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, parsed.data))
      .for("update");
    if (!row) return INVALID;
    if (!row.deletedAt) await removeLockedComment(tx, parsed.data);
    return { ok: true as const };
  });
}

const THANKS = { ok: true } as const;

// Files a report, snapshotting the comment as it reads now. It always thanks
// the reporter — for their own comment, a removed one, or a second report of
// the same comment it quietly writes nothing.
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

  return db.transaction(async (tx) => {
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
      return THANKS;
    }
    await tx
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
      });
    return THANKS;
  });
}

const reporter = alias(users, "reporter");
const snapshotAuthor = alias(users, "snapshot_author");

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

// The reports inbox, newest first: each report's snapshot beside the comment
// as it is now.
export async function listReports(
  opts: { status?: ReportStatus | "all" } = {},
): Promise<ReportView[]> {
  await requireAdmin();
  const status = opts.status ?? "open";
  const rows = await db
    .select({
      id: commentReports.id,
      reason: commentReports.reason,
      note: commentReports.note,
      status: commentReports.status,
      createdAt: commentReports.createdAt,
      resolvedAt: commentReports.resolvedAt,
      issueId: issues.id,
      issueNumber: issues.number,
      issueTitle: issues.title,
      reporterId: reporter.id,
      reporterName: reporter.name,
      snapshotBody: commentReports.snapshotBody,
      snapshotName: commentReports.snapshotName,
      snapshotAuthorId: snapshotAuthor.id,
      snapshotAuthorName: snapshotAuthor.name,
      snapshotCreatedAt: commentReports.snapshotCreatedAt,
      snapshotEditedAt: commentReports.snapshotEditedAt,
      commentId: comments.id,
      commentBody: comments.body,
      commentEditedAt: comments.editedAt,
      commentHiddenAt: comments.hiddenAt,
      commentDeletedAt: comments.deletedAt,
    })
    .from(commentReports)
    .innerJoin(issues, eq(issues.id, commentReports.issueId))
    .leftJoin(reporter, eq(reporter.id, commentReports.reporterId))
    .leftJoin(
      snapshotAuthor,
      eq(snapshotAuthor.id, commentReports.snapshotAuthorId),
    )
    .leftJoin(comments, eq(comments.id, commentReports.commentId))
    .where(status === "all" ? undefined : eq(commentReports.status, status))
    .orderBy(desc(commentReports.createdAt), desc(commentReports.id));

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    issue: { id: row.issueId, number: row.issueNumber, title: row.issueTitle },
    reporter: row.reporterId
      ? { id: row.reporterId, name: row.reporterName }
      : null,
    snapshot: {
      body: row.snapshotBody,
      name: row.snapshotName,
      account: row.snapshotAuthorId
        ? { id: row.snapshotAuthorId, name: row.snapshotAuthorName }
        : null,
      createdAt: row.snapshotCreatedAt,
      editedAt: row.snapshotEditedAt,
    },
    current:
      row.commentId === null || row.commentDeletedAt !== null
        ? { state: "deleted" as const }
        : {
            state: sameTime(row.commentEditedAt, row.snapshotEditedAt)
              ? ("unchanged" as const)
              : ("edited" as const),
            body: row.commentBody ?? "",
            hidden: row.commentHiddenAt !== null,
          },
  }));
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
