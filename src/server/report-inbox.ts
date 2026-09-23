import "server-only";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  commentReports,
  comments,
  images,
  issues,
  memberNames,
  users,
} from "@/db/schema";
import type { ReportFilter, ReportView } from "@/lib/comments";
import { likePattern } from "@/lib/like-pattern";
import {
  ADMIN_LIST_PAGE_SIZE,
  pageBounds,
  type PagedList,
} from "@/lib/pagination";
import { keyToUrl } from "@/lib/storage";
import { requireAdmin } from "./session";

// The reports inbox at /admin/reports (issue #302), in the shared admin list
// contract: 25 a page, newest first, with the search and the status filter run
// in the database so they see every report, not just the served page.

export type ReportList = PagedList<ReportView> & {
  /** Every report, and the open ones, whatever the search or filter. */
  total: number;
  openTotal: number;
};

const reporter = alias(users, "reporter");
const snapshotAuthor = alias(users, "snapshot_author");
const resolver = alias(users, "resolver");

const FILTER_CONDITIONS = {
  open: eq(commentReports.status, "open"),
  resolved: eq(commentReports.status, "resolved"),
  all: undefined,
} as const;

// The search covers what the admin can read on a row: the comment as
// reported, the name it was posted under, and who reported it.
function reportWhere(query: string, filter: ReportFilter) {
  const pattern = likePattern(query);
  const conditions = [
    query
      ? or(
          ilike(commentReports.snapshotBody, pattern),
          ilike(commentReports.snapshotName, pattern),
          ilike(reporter.name, pattern),
          ilike(reporter.email, pattern),
        )
      : undefined,
    FILTER_CONDITIONS[filter],
  ].filter((c) => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

// Counts and the page's rows read one snapshot (as listUsers does), so the
// clamp and the rows below it can't disagree mid-moderation.
export async function listReports(
  opts: { query?: string; page?: number; filter?: ReportFilter } = {},
): Promise<ReportList> {
  await requireAdmin();
  const query = opts.query?.trim() ?? "";
  const where = reportWhere(query, opts.filter ?? "open");

  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({
          total: count(),
          openTotal:
            sql`count(*) filter (where ${commentReports.status} = 'open')`.mapWith(
              Number,
            ),
          matching: where
            ? sql`count(*) filter (where ${where})`.mapWith(Number)
            : count(),
        })
        .from(commentReports)
        .leftJoin(reporter, eq(reporter.id, commentReports.reporterId));
      const matching = counts?.matching ?? 0;
      const bounds = pageBounds(matching, ADMIN_LIST_PAGE_SIZE, opts.page);

      const rows = await tx
        .select({
          id: commentReports.id,
          reason: commentReports.reason,
          note: commentReports.note,
          status: commentReports.status,
          createdAt: commentReports.createdAt,
          resolvedAt: commentReports.resolvedAt,
          resolverId: resolver.id,
          resolverName: resolver.name,
          issueId: issues.id,
          issueNumber: issues.number,
          issueTitle: issues.title,
          reporterId: reporter.id,
          reporterName: reporter.name,
          reporterEmail: reporter.email,
          snapshotBody: commentReports.snapshotBody,
          snapshotName: commentReports.snapshotName,
          snapshotAuthorId: snapshotAuthor.id,
          snapshotAuthorName: snapshotAuthor.name,
          snapshotAuthorEmail: snapshotAuthor.email,
          snapshotCreatedAt: commentReports.snapshotCreatedAt,
          snapshotEditedAt: commentReports.snapshotEditedAt,
          commentId: comments.id,
          commentBody: comments.body,
          commentEditedAt: comments.editedAt,
          commentHiddenAt: comments.hiddenAt,
          commentDeletedAt: comments.deletedAt,
          nameId: memberNames.id,
          nameText: memberNames.name,
          nameRetiredAt: memberNames.retiredAt,
          avatarKey: images.key,
        })
        .from(commentReports)
        .innerJoin(issues, eq(issues.id, commentReports.issueId))
        .leftJoin(reporter, eq(reporter.id, commentReports.reporterId))
        .leftJoin(resolver, eq(resolver.id, commentReports.resolvedBy))
        .leftJoin(
          snapshotAuthor,
          eq(snapshotAuthor.id, commentReports.snapshotAuthorId),
        )
        .leftJoin(comments, eq(comments.id, commentReports.commentId))
        .leftJoin(memberNames, eq(memberNames.id, comments.authorNameId))
        .leftJoin(images, eq(images.id, memberNames.avatarImageId))
        .where(where)
        .orderBy(desc(commentReports.createdAt), desc(commentReports.id))
        .limit(ADMIN_LIST_PAGE_SIZE)
        .offset(bounds.offset);

      return {
        rows: rows.map(toView),
        page: bounds.page,
        pageCount: bounds.pageCount,
        matching,
        total: counts?.total ?? 0,
        openTotal: counts?.openTotal ?? 0,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

type Row = {
  id: string;
  reason: ReportView["reason"];
  note: string | null;
  status: ReportView["status"];
  createdAt: Date;
  resolvedAt: Date | null;
  resolverId: string | null;
  resolverName: string | null;
  issueId: string;
  issueNumber: number | null;
  issueTitle: string;
  reporterId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  snapshotBody: string;
  snapshotName: string | null;
  snapshotAuthorId: string | null;
  snapshotAuthorName: string | null;
  snapshotAuthorEmail: string | null;
  snapshotCreatedAt: Date | null;
  snapshotEditedAt: Date | null;
  commentId: string | null;
  commentBody: string | null;
  commentEditedAt: Date | null;
  commentHiddenAt: Date | null;
  commentDeletedAt: Date | null;
  nameId: string | null;
  nameText: string | null;
  nameRetiredAt: Date | null;
  avatarKey: string | null;
};

function currentState(row: Row): ReportView["current"] {
  if (row.commentId === null) return { state: "deleted", by: "author" };
  if (row.commentDeletedAt !== null) {
    // An admin's delete of a reported comment keeps the row, hidden.
    return { state: "deleted", by: row.commentHiddenAt ? "admin" : "author" };
  }
  return {
    state: sameTime(row.commentEditedAt, row.snapshotEditedAt)
      ? "unchanged"
      : "edited",
    commentId: row.commentId,
    body: row.commentBody ?? "",
    hidden: row.commentHiddenAt !== null,
  };
}

function toView(row: Row): ReportView {
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolverId
      ? { id: row.resolverId, name: row.resolverName }
      : null,
    issue: { id: row.issueId, number: row.issueNumber, title: row.issueTitle },
    reporter: row.reporterId
      ? {
          id: row.reporterId,
          name: row.reporterName,
          email: row.reporterEmail ?? "",
        }
      : null,
    snapshot: {
      body: row.snapshotBody,
      name: row.snapshotName,
      account: row.snapshotAuthorId
        ? {
            id: row.snapshotAuthorId,
            name: row.snapshotAuthorName,
            email: row.snapshotAuthorEmail ?? "",
          }
        : null,
      createdAt: row.snapshotCreatedAt,
      editedAt: row.snapshotEditedAt,
    },
    current: currentState(row),
    name:
      row.nameId && row.nameText
        ? {
            id: row.nameId,
            name: row.nameText,
            avatarUrl: row.avatarKey ? keyToUrl(row.avatarKey) : null,
            retired: row.nameRetiredAt !== null,
          }
        : null,
  };
}

/** The admin nav's badge and the Issues page's summary line. */
export async function countOpenReports(): Promise<number> {
  await requireAdmin();
  const [row] = await db
    .select({ n: count() })
    .from(commentReports)
    .where(eq(commentReports.status, "open"));
  return row?.n ?? 0;
}
